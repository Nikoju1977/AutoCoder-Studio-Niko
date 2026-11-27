import unittest
from types import SimpleNamespace
from quantum_hardware import validate, fingerprint, submit, retrieve

class HardwareTests(unittest.TestCase):
    def setUp(self):
        self.spec = validate({"qubits": 2, "gates": [{"gate": "H", "target": 0}]}, 256)
        self.backend = SimpleNamespace(name="mock-qpu", configuration=lambda: SimpleNamespace(simulator=False))
        self.svc = SimpleNamespace(least_busy=lambda **kw: self.backend, active_instance=lambda: "crn", instances=lambda: [{"crn": "crn", "plan": "open"}])

    def test_invalid(self):
        for n in (True, 33, 0):
            with self.assertRaises(ValueError):
                validate({"qubits": n, "gates": []}, 256)
        with self.assertRaises(ValueError):
            validate({"qubits": 2, "gates": []}, 1025)

    def test_approval_and_simulator_refusal(self):
        def forbidden(**kw):
            self.fail("sampler called")
        with self.assertRaises(ValueError):
            submit(self.spec, "wrong", self.svc, forbidden)
        self.backend.configuration = lambda: SimpleNamespace(simulator=True)
        with self.assertRaises(ValueError):
            submit(self.spec, fingerprint(self.spec), self.svc, forbidden)

    def test_paid_plan_refused(self):
        self.svc.instances = lambda: [{"crn": "crn", "plan": "premium"}]
        with self.assertRaises(ValueError):
            submit(self.spec, fingerprint(self.spec), self.svc, lambda **kw: self.fail("sampler called"))

    def test_submission_not_hardware_evidence(self):
        job = SimpleNamespace(job_id=lambda: "mock-id")
        factory = lambda **kw: SimpleNamespace(run=lambda *a, **k: job)
        r = submit(self.spec, fingerprint(self.spec), self.svc, factory, compiler=lambda s,b: "mock-isa")
        self.assertEqual(r["status"], "submitted")
        self.assertFalse(r["hardwareVerified"])

    def test_completed_result(self):
        self.svc.job = lambda id: SimpleNamespace(backend=lambda: self.backend, status=lambda: "DONE", result=lambda: [SimpleNamespace(data=SimpleNamespace(meas=SimpleNamespace(get_counts=lambda: {"00": 128, "11": 128})))])
        self.assertEqual(retrieve(self.svc, "mock-id")["shots"], 256)

if __name__ == "__main__":
    unittest.main()
