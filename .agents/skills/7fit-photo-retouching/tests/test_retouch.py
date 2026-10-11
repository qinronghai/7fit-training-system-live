import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

SKILL = Path(__file__).resolve().parents[1]
CLI = SKILL / 'scripts' / 'retouch.py'


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.inputs = self.root / 'inputs'
        self.outputs = self.root / 'outputs'
        self.inputs.mkdir()
        self.photo = self.inputs / 'member.jpg'
        Image.new('RGB', (320, 240), (115, 120, 128)).save(self.photo)
        self.original_sha = hashlib.sha256(self.photo.read_bytes()).hexdigest()

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(CLI), *map(str, args)], capture_output=True,text=True)

    def batch(self, *args, mode='course'):
        return self.run_cli('batch', '--input', self.inputs, '--output', self.outputs, '--mode', mode, *args)

    def test_privacy_explicit(self):
        r = self.batch()
        self.assertNotEqual(r.returncode,0)
        self.assertIn('privacy',r.stderr)

    def test_manual_face_blur_and_export(self):
        boxes = self.root / 'boxes.json'
        boxes.write_text(json.dumps({'member.jpg': [[.2,.2,.4,.4]]}))
        r = self.batch('--privacy','blur','--face-boxes',boxes,'--exports','original','4x5','9x16')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(self.original_sha,hashlib.sha256(self.photo.read_bytes()).hexdigest())
        record=json.loads((self.outputs / 'manifest.json').read_text())
        self.assertTrue(record['review_required'])
        self.assertEqual(record['results'][0]['face_boxes_count'],1)
        self.assertEqual(len(record['results'][0]['exports']),3)
        with Image.open(self.outputs/'member_7fit.jpg') as image:
            self.assertEqual(image.size,(320,240))
        with Image.open(self.outputs/'member_7fit_4x5.jpg') as image:
            self.assertEqual(image.size,(1200,1500))
        with Image.open(self.outputs/'member_7fit_9x16.jpg') as image:
            self.assertEqual(image.size,(1080,1920))
        with Image.open(self.outputs/'member_7fit.jpg') as image:
            self.assertEqual(len(image.getexif()),0)

    def test_detected_no_faces_is_not_autocleared(self):
        boxes=self.root/'boxes.json'
        boxes.write_text(json.dumps({'member.jpg': []}))
        r=self.batch('--privacy','blur','--face-boxes',boxes)
        self.assertNotEqual(r.returncode,0)
        self.assertEqual(json.loads((self.outputs/'manifest.json').read_text())['failed'],1)

    def test_invalid_box_rejected(self):
        boxes=self.root/'boxes.json'
        boxes.write_text(json.dumps({'member.jpg': [[.8,.1,.1,.2]]}))
        r=self.batch('--privacy','blur','--face-boxes',boxes)
        self.assertNotEqual(r.returncode,0)

    def test_comparison_is_neutral_and_fixed(self):
        r=self.batch('--privacy','keep','--exports','4x5', mode='comparison')
        self.assertNotEqual(r.returncode,0)
        r=self.batch('--privacy','keep', mode='comparison')
        self.assertEqual(r.returncode,0,r.stderr)
        with Image.open(self.outputs/'member_7fit.jpg') as image:
            self.assertEqual(image.size,(320,240))

    def test_no_overwrite_without_opt_in(self):
        a=self.batch('--privacy','keep')
        self.assertEqual(a.returncode,0,a.stderr)
        b=self.batch('--privacy','keep')
        self.assertNotEqual(b.returncode,0)
        self.assertIn('exists', json.loads((self.outputs/'manifest.json').read_text())['errors'][0]['error'])

    def test_inspect(self):
        r=self.run_cli('inspect',self.photo)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(json.loads(r.stdout)['width'],320)


if __name__=='__main__':
    unittest.main()