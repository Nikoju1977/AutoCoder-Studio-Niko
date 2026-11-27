"""Studio Niko SDK: local subprocess transport, no network or external package."""
import json
import subprocess
from pathlib import Path

PROTOCOL = "studio-niko-tools/1"

class Client:
    def __init__(self, gateway, app, project="-", *, quantum_simulation=False, node="node"):
        self.gateway = str(Path(gateway).resolve())
        self.app = app
        self.project = str(Path(project).resolve()) if project != "-" else "-"
        self.flags = ["--quantum-simulation"] if quantum_simulation else []
        self.node = node
        self.seq = 0

    def _request(self, method, params):
        self.seq += 1
        ident = f"req-{self.seq}"
        raw = json.dumps({"protocol": PROTOCOL, "id": ident, "method": method, "params": params}, allow_nan=False)
        if len(raw.encode()) > 24000:
            raise ValueError("Request too large")
        result = subprocess.run([self.node, self.gateway, self.app, self.project, *self.flags],
                                input=raw, text=True, capture_output=True, timeout=15, check=True)
        if len(result.stdout.encode()) > 256000:
            raise ValueError("Response too large")
        response = json.loads(result.stdout)
        if response.get("protocol") != PROTOCOL or response.get("id") != ident or type(response.get("ok")) is not bool:
            raise ValueError("Invalid response")
        if not response["ok"]:
            raise RuntimeError(response.get("error", {}).get("code", "GATEWAY_ERROR"))
        return response["result"]

    def list(self):
        return self._request("tools.list", {})

    def call(self, name, args=None):
        return self._request("tools.call", {"name": name, "args": {} if args is None else args})
