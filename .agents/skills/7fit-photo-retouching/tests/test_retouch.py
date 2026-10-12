"""Deterministic V1.1 pipeline tests. Uses synthetic non-member photos only."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

SKILL=Path(__file__).resolve().parents[1]
CLI=SKILL/'scripts'/'retouch.py'
spec=importlib.util.spec_from_file_location('sevenfit',CLI)
core=importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

class RetouchV11Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.src=self.root/'sources'
        self.out=self.root/'exports'
        self.src.mkdir()
        self.img=self.src/'member.jpg'
        # Procedural high-key window / dark floor / skin-neutral gradient
        im=Image.new('RGB',(400,300))
        px=im.load()
        for y in range(300):
            for x in range(400):
                px[x,y]=(250,249,247) if x<90 else ((45+y//7,55+y//8,65+y//8) if y>220 else (145+x//9,137+y//6,129+y//6))
        im.save(self.img,quality=96)
        self.before=hashlib.sha256(self.img.read_bytes()).hexdigest()
        self.ann=self.root/'review.json'

    def review(self, record=None, file='member.jpg'):
        self.ann.write_text(json.dumps({file: record or {'reviewed':True,'no_visible_face':True}}),encoding='utf-8')
        return self.ann

    def cli(self,*args):
        return subprocess.run([sys.executable,str(CLI),*map(str,args)],capture_output=True,text=True)

    def batch(self,*params,mode='course',privacy='blur'):
        return self.cli('batch','--input',self.src,'--output',self.out,'--mode',mode,'--privacy',privacy,'--annotations',self.ann,*params)

    def test_inspect(self):
        r=self.cli('inspect',self.img)
        self.assertEqual(r.returncode,0,r.stderr)
        obj=json.loads(r.stdout)
        self.assertEqual(obj['dimensions'],[400,300])
        self.assertIn('p99',obj['luma'])

    def test_review_required(self):
        self.ann.write_text('{}')
        r=self.batch()
        self.assertEqual(r.returncode,1,r.stderr)
        self.assertIn('missing per-photo review',r.stderr)
        self.assertEqual(list(self.out.glob('*.jpg')),[])

    def test_no_global_no_face_waiver(self):
        self.review({'reviewed':True,'faces':[]})
        r=self.batch()
        self.assertEqual(r.returncode,1)
        self.assertIn('no_visible_face',r.stderr)

    def test_blur_reviewed_and_exports(self):
        self.review({'reviewed':True,'faces':[[.45,.18,.63,.48]]})
        r=self.batch('--exports','original','4x5','9x16')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(self.before,hashlib.sha256(self.img.read_bytes()).hexdigest())
        data=json.loads((self.out/'manifest.json').read_text())
        self.assertFalse(data['safe_to_publish'])
        self.assertEqual(data['results'][0]['face_boxes_count'],1)
        self.assertEqual(data['schema_version'],'1.1')
        self.assertEqual([e['framing'] for e in data['results'][0]['exports']],['original-no-crop','contain-pad','contain-pad'])
        for fname,size in [('member_7fit.jpg',(400,300)),('member_7fit_4x5.jpg',(1200,1500)),('member_7fit_9x16.jpg',(1080,1920))]:
            with Image.open(self.out/fname) as im:
                self.assertEqual(im.size,size)
                self.assertFalse(im.getexif())

    def test_feaureless_back_no_blur(self):
        self.review()
        self.assertEqual(self.batch().returncode,0)
        self.assertEqual(json.loads((self.out/'manifest.json').read_text())['results'][0]['face_boxes_count'],0)

    def test_keep_requires_consent_per_image(self):
        self.review({'reviewed':True,'no_visible_face':True})
        r=self.batch(privacy='keep')
        self.assertEqual(r.returncode,1)
        self.assertIn('consent_confirmed',r.stderr)
        self.review({'reviewed':True,'consent_confirmed':True})
        self.assertEqual(self.batch(privacy='keep').returncode,0)

    def test_none_requires_no_visible_face(self):
        self.review({'reviewed':True,'faces':[[.1,.2,.2,.3]]})
        self.assertEqual(self.batch(privacy='none').returncode,1)
        self.review({'reviewed':True,'no_visible_face':True})
        self.assertEqual(self.batch(privacy='none').returncode,0)

    def test_invalid_and_nan_rect(self):
        for rect in [[.8,.1,.2,.3],[0,0,float('nan'),.4],[True,0,.3,.5]]:
            with self.subTest(rect=rect):
                self.review({'reviewed':True,'faces':[rect]})
                self.assertEqual(self.batch().returncode,1)

    def test_crop_requires_explicit_review(self):
        self.review({'reviewed':True,'no_visible_face':True,'crop':[.1,.1,.9,.9]})
        self.assertEqual(self.batch().returncode,1)
        self.review({'reviewed':True,'no_visible_face':True,'crop':[.1,.1,.9,.9],'crop_reviewed':True})
        self.assertEqual(self.batch().returncode,0)
        with Image.open(self.out/'member_7fit.jpg') as im:
            self.assertEqual(im.size,(320,240))

    def test_crop_must_contain_face(self):
        self.review({'reviewed':True,'faces':[[.2,.2,.4,.4]],'crop':[.5,.1,.9,.9],'crop_reviewed':True})
        self.assertEqual(self.batch().returncode,1)

    def test_comparison_strict(self):
        self.review({'reviewed':True,'no_visible_face':True})
        self.assertEqual(self.batch('--exports','4x5',mode='comparison').returncode,1)
        self.review({'reviewed':True,'no_visible_face':True,'crop':[0,0,.9,.9],'crop_reviewed':True})
        self.assertEqual(self.batch(mode='comparison').returncode,1)
        self.review()
        self.assertEqual(self.batch(mode='comparison').returncode,0)
        with Image.open(self.out/'member_7fit.jpg') as im:
            self.assertEqual(im.size,(400,300))

    def test_mixed_modes_are_independent(self):
        Image.new('RGB',(200,300),(180,180,180)).save(self.src/'room.jpg')
        self.ann.write_text(json.dumps({'member.jpg':{'reviewed':True,'no_visible_face':True,'mode':'course'},
                                         'room.jpg':{'reviewed':True,'no_visible_face':True,'mode':'venue'}}))
        r=self.batch()
        self.assertEqual(r.returncode,0,r.stderr)
        data=json.loads((self.out/'manifest.json').read_text())
        self.assertEqual({rec['mode'] for rec in data['results']},{'course','venue'})

    def test_batch_all_or_nothing(self):
        self.review()
        (self.src/'corrupted.jpg').write_bytes(b'not an image')
        self.ann.write_text(json.dumps({'member.jpg':{'reviewed':True,'no_visible_face':True},
                                        'corrupted.jpg':{'reviewed':True,'no_visible_face':True}}))
        r=self.batch()
        self.assertEqual(r.returncode,1)
        self.assertEqual(list(self.out.glob('*.jpg')),[])
        self.assertEqual(json.loads((self.out/'manifest.json').read_text())['successful'],0)

    def test_collision_does_not_overwrite(self):
        self.review()
        self.assertEqual(self.batch().returncode,0)
        before=(self.out/'member_7fit.jpg').read_bytes()
        self.assertEqual(self.batch().returncode,1)
        self.assertEqual((self.out/'member_7fit.jpg').read_bytes(),before)

    def test_output_inside_source_rejected(self):
        self.review()
        out=self.src/'sub'
        r=self.cli('batch','--input',self.src,'--output',out,'--privacy','blur','--annotations',self.ann)
        self.assertEqual(r.returncode,2)

    def test_brightness_curve_limits_white(self):
        im=Image.new('RGB',(128,128),(249,249,249))
        out,record=core.grade(im,'venue',1)
        self.assertLessEqual(max(out.getpixel((0,0))),252)
        self.assertLessEqual(record['gamma'],1)
        self.assertGreaterEqual(record['gamma'],.89)
        mid=Image.new('RGB',(128,128),(70,80,90))
        lifted,_=core.grade(mid,'venue',1)
        self.assertGreater(sum(lifted.getpixel((0,0))),sum(mid.getpixel((0,0))))

    def test_blur_outside_region_preserved(self):
        im=Image.new('RGB',(220,220),'white')
        out=core.blur_faces(im,[(90,90,150,150)])
        self.assertEqual(im.getpixel((10,10)),out.getpixel((10,10)))

    def test_export_without_exif(self):
        self.review()
        self.assertEqual(self.batch().returncode,0)
        with Image.open(self.out/'member_7fit.jpg') as im:
            self.assertNotIn(34853,im.getexif())

    def test_reject_unreviewed_detector_output(self):
        self.review({'reviewed':False,'faces':[[.1,.1,.3,.3]]})
        self.assertEqual(self.batch().returncode,1)

    def test_strength_zero_preserves_geometry(self):
        im=Image.new('RGB',(37,55),(150,145,148))
        result,params=core.grade(im,'venue',0)
        self.assertEqual(result.tobytes(),im.tobytes())
        self.assertEqual(result.size,im.size)

if __name__=='__main__':
    unittest.main()