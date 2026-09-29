"""Neural preparation does not install a native scene renderer."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

from fly import environment
from fly.store import atomic_json


class ImmediateThread:
    def __init__(self, target, **_):
        self.target = target

    def start(self):
        self.target()


class EnvironmentTests(unittest.TestCase):
    def test_ready_brain_needs_no_blender_and_preserves_legacy_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            python = root / 'python.exe'
            python.touch()
            data = root / 'brain'
            data.mkdir()
            (data / 'graph.npz').touch()
            legacy_path = str(root / 'removed-blender.exe')
            atomic_json(root / 'environment.json', {
                'python': str(python), 'data': str(data), 'blender': legacy_path,
            })
            with patch.dict(environment.os.environ, {}, clear=True), \
                    patch.object(environment.threading, 'Thread', ImmediateThread), \
                    patch.object(environment, 'download') as download:
                self.assertFalse(environment.detect(root)['blender_ready'])
                environment.prepare(root)
                result = environment.detect(root)
            download.assert_not_called()
            self.assertTrue(result['brain_ready'])
            self.assertEqual(result['progress']['status'], 'ready')
            self.assertEqual(result['blender'], legacy_path)
            self.assertFalse(result['blender_ready'])

    def test_fresh_neural_install_downloads_only_neural_dependencies(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            urls = []

            def download(url, path, *_):
                urls.append(url)
                path = Path(path)
                path.parent.mkdir(parents=True, exist_ok=True)
                with zipfile.ZipFile(path, 'w'):
                    pass
                return path

            def extract(_, target):
                target = Path(target)
                target.mkdir(parents=True, exist_ok=True)
                if target.name == 'python312':
                    (target / 'python.exe').touch()

            def prepare_connectome(*_, **kwargs):
                data = Path(kwargs['env']['OPENFLY_DATA'])
                data.mkdir(parents=True, exist_ok=True)
                (data / 'graph.npz').touch()
                return Mock(stdout=[], wait=Mock(return_value=0))

            with patch.dict(environment.os.environ, {}, clear=True), \
                    patch.object(environment.shutil, 'which', return_value=None), \
                    patch.object(environment.threading, 'Thread', ImmediateThread), \
                    patch.object(environment.threading, 'Timer'), \
                    patch.object(environment, 'download', side_effect=download), \
                    patch.object(environment, 'extract', side_effect=extract), \
                    patch.object(environment.subprocess, 'Popen', side_effect=prepare_connectome):
                environment.prepare(root)
                result = environment.detect(root)
            manifest = json.loads(Path(environment.__file__).with_name('dependencies.json').read_text('utf-8'))
            self.assertEqual(urls, [manifest['python']['url'], *[w['url'] for w in manifest['wheels']], manifest['openfly']['url']])
            self.assertTrue(result['brain_ready'])
            self.assertFalse(result['blender_ready'])
            self.assertEqual(result['progress']['status'], 'ready')


if __name__ == '__main__':
    unittest.main()
