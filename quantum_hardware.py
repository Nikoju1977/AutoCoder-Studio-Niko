# SPDX-License-Identifier: MIT
"""Hardware-only IBM Quantum bridge. No simulator or automatic retries."""
import argparse
import hashlib
import json
import math
import os
import re
import sys
from pathlib import Path

SINGLE = {"H", "X", "Y", "Z", "S", "T", "RX", "RY", "RZ"}
PAIR = {"CX", "CZ", "SWAP"}

def integer(v):
    return type(v) is int

def validate(circuit, shots):
    if not isinstance(circuit, dict) or set(circuit) != {"qubits", "gates"}:
        raise ValueError("Invalid circuit")
    n, gates = circuit["qubits"], circuit["gates"]
    if not integer(n) or not 1 <= n <= 32 or not isinstance(gates, list) or len(gates) > 128:
        raise ValueError("Circuit limit: 32 qubits / 128 gates")
    if not integer(shots) or not 1 <= shots <= 1024:
        raise ValueError("Shots: 1–1024")
    for g in gates:
        if not isinstance(g, dict) or not isinstance(g.get("gate"), str):
            raise ValueError("Invalid gate")
        op, target = g["gate"], g.get("target")
        if op not in SINGLE | PAIR or not integer(target) or not 0 <= target < n:
            raise ValueError("Invalid gate or target")
        keys = {"gate", "target"}
        if op in PAIR:
            keys.add("control")
            c = g.get("control")
            if not integer(c) or not 0 <= c < n or c == target:
                raise ValueError("Invalid control")
        if op in {"RX", "RY", "RZ"}:
            keys.add("theta")
            a = g.get("theta")
            if type(a) not in (int, float) or abs(a) > 1e6 or not math.isfinite(a):
                raise ValueError("Invalid angle")
        if set(g) != keys:
            raise ValueError("Unexpected gate fields")
    return {"circuit": circuit, "shots": shots}

def fingerprint(spec):
    return hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()

def read_spec(path, shots):
    with Path(path).open("rb") as f:
        data = f.read(32769)
    if len(data) > 32768:
        raise ValueError("Circuit file too large")
    return validate(json.loads(data), shots)

def service():
    from qiskit_ibm_runtime import QiskitRuntimeService
    token = os.environ.get("IBM_QUANTUM_API_KEY")
    if not token:
        raise ValueError("IBM_QUANTUM_API_KEY is required in the local environment")
    # Only Open Plan instances. No explicit instance override, which bypasses this filter.
    return QiskitRuntimeService(channel="ibm_quantum_platform", token=token, plans_preference=["open"])

def require_open(svc):
    active = svc.active_instance()
    if not active or not any(i.get("crn") == active and str(i.get("plan", "")).lower() == "open" for i in svc.instances()):
        raise ValueError("Active Open Plan instance not verified; refusing operation")

def require_hardware(backend):
    if backend.configuration().simulator is not False:
        raise ValueError("Simulator or unverified backend refused")

def compile_circuit(spec, backend):
    from qiskit import QuantumCircuit
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    data = spec["circuit"]
    qc = QuantumCircuit(data["qubits"])
    for g in data["gates"]:
        fn = getattr(qc, g["gate"].lower())
        if g["gate"] in PAIR:
            fn(g["control"], g["target"])
        elif "theta" in g:
            fn(g["theta"], g["target"])
        else:
            fn(g["target"])
    qc.measure_all()
    return generate_preset_pass_manager(backend=backend, optimization_level=1, seed_transpiler=42).run(qc)

def submit(spec, approval, svc, sampler_factory, compiler=compile_circuit):
    spec = validate(spec["circuit"], spec["shots"])
    if approval != fingerprint(spec):
        raise ValueError("Exact SHA-256 approval required")
    backend = svc.least_busy(operational=True, simulator=False, min_num_qubits=spec["circuit"]["qubits"])
    require_hardware(backend)
    require_open(svc)
    isa = compiler(spec, backend)
    # No automatic retry: uncertain submissions must be checked in IBM dashboard.
    job = sampler_factory(mode=backend).run([isa], shots=spec["shots"])
    return {"status": "submitted", "provider": "IBM Quantum", "backend": backend.name,
            "jobId": job.job_id(), "shots": spec["shots"], "digest": approval,
            "hardwareVerified": False, "backendType": "physical_qpu_selected"}

def retrieve(svc, job_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", job_id):
        raise ValueError("Invalid job ID")
    job = svc.job(job_id)
    backend = job.backend()
    require_hardware(backend)
    require_open(svc)
    state = job.status()
    out = {"provider": "IBM Quantum", "backend": backend.name, "jobId": job_id,
           "status": str(state), "hardwareVerified": False}
    if str(state).upper().split(".")[-1] == "DONE":
        result = job.result()
        if len(result) != 1:
            raise ValueError("Expected one circuit result")
        counts = result[0].data.meas.get_counts()
        out.update(counts=counts, shots=sum(counts.values()), hardwareVerified=True)
    return out

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for cmd in ("prepare", "submit"):
        p = sub.add_parser(cmd)
        p.add_argument("circuit")
        p.add_argument("--shots", type=int, default=256)
        if cmd == "submit":
            p.add_argument("--approve", required=True)
    p = sub.add_parser("result")
    p.add_argument("job_id")
    sub.add_parser("backends")
    args = parser.parse_args()
    if args.command in ("prepare", "submit"):
        spec = read_spec(args.circuit, args.shots)
        digest = fingerprint(spec)
        if args.command == "prepare":
            return {"status": "prepared_not_submitted", "digest": digest, **spec}
        if args.approve != digest:
            raise ValueError("Exact SHA-256 approval required")
        from qiskit_ibm_runtime import SamplerV2
        return submit(spec, args.approve, service(), SamplerV2)
    svc = service()
    if args.command == "result":
        return retrieve(svc, args.job_id)
    rows = svc.backends(operational=True, simulator=False)
    return {"provider": "IBM Quantum", "backends": [{"name": b.name, "qubits": b.num_qubits} for b in rows if b.configuration().simulator is False]}

if __name__ == "__main__":
    try:
        print(json.dumps(main(), indent=2))
    except Exception as exc:
        # Never print upstream exceptions which may include credentials or account identifiers.
        print("Operation refused or unavailable: " + type(exc).__name__ +
              (": " + str(exc) if type(exc) is ValueError else ""), file=sys.stderr)
        sys.exit(1)
