import sys
import tempfile
import unittest
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sdk"))
from client import Client

class SDKTests(unittest.TestCase):
    def test_real_subprocess(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "project.json"
            p.write_text(json.dumps({"projectName": "demo", "files": {"config.json": "{"}}))
            c = Client(ROOT / "scripts" / "gateway.mjs", "python-test", p)
            self.assertEqual(len(c.list()["tools"]), 3)
            self.assertIn("JSON_INVALID", json.dumps(c.call("project.audit")))
            with self.assertRaises(RuntimeError):
                c.call("github.catalog", {"owner": "Niko", "page": 1})

if __name__ == "__main__":
    unittest.main()
