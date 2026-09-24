import json
import os
from pathlib import Path
import tempfile
import unittest

from fly.store import atomic_json


class AtomicJsonTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'nt', 'Windows extended-path regression')
    def test_checkpoint_temporary_path_over_max_path(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            padding = 235 - len(str(base)) - 1
            if padding < 1:
                self.skipTest('Temporary directory already exceeds test path budget')
            parent = base / ('x' * padding)
            parent.mkdir()
            target = parent / 'policy.json'
            self.assertLess(len(str(target)), 260)
            self.assertGreater(len(str(parent)) + 41, 260)
            atomic_json(target, {'checkpoint': True})
            self.assertEqual(json.loads(target.read_text('utf-8')), {'checkpoint': True})
            self.assertEqual(list(parent.iterdir()), [target])

    def test_archive_manifest_in_deep_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            padding = 205 - len(str(base)) - 1
            if padding < 1:
                self.skipTest('Temporary directory already exceeds test path budget')
            parent = base / ('x' * padding)
            parent.mkdir()
            target = parent / '2026-09-24.sha256.json'
            self.assertLess(len(str(target)), 260)
            self.assertGreater(len(str(target)) + 41, 260)
            for value in ({'sha256': 'first'}, {'sha256': 'replacement'}):
                atomic_json(target, value)
                self.assertEqual(json.loads(target.read_text('utf-8')), value)
            self.assertEqual(list(parent.iterdir()), [target])


if __name__ == '__main__':
    unittest.main()
