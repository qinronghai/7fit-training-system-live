#!/usr/bin/env python3
"""7Fit V1.1: fail-closed, non-generative photo development & privacy review.

Requires Pillow. Optional opencv-python and numpy for NON-APPROVED face suggestions.
No semantic segmentation, selective object removal, generative editing, or body modification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

SUPPORTED = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'}
PRESETS = {
    'course': {'gamma_dark': .915, 'gamma_light': .980, 'contrast': 1.012, 'color': 1.018, 'sharpness': 1.015, 'warmth': .002},
    'venue': {'gamma_dark': .905, 'gamma_light': .982, 'contrast': 1.015, 'color': 1.015, 'sharpness': 1.020, 'warmth': -.001},
    'portrait': {'gamma_dark': .925, 'gamma_light': .987, 'contrast': 1.005, 'color': 1.000, 'sharpness': 1.000, 'warmth': .001},
    'comparison': {'gamma_dark': 1.0, 'gamma_light': 1.0, 'contrast': 1.0, 'color': 1.0, 'sharpness': 1.0, 'warmth': 0.0},
}
SIZES = {'original': None, '4x5': (1200, 1500), '9x16': (1080, 1920)}
MAX_PIXELS = 80_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read_image(path: Path) -> tuple[Image.Image, dict]:
    with Image.open(path) as im:
        if im.width * im.height > MAX_PIXELS:
            raise ValueError('Image exceeds safe pixel limit')
        source_meta = {'embedded_icc': bool(im.info.get('icc_profile')), 'source_exif': bool(im.getexif())}
        im.load()
        fixed = ImageOps.exif_transpose(im)
        if fixed.mode in ('RGBA', 'LA') or (fixed.mode == 'P' and 'transparency' in fixed.info):
            rgba = fixed.convert('RGBA')
            base = Image.new('RGBA', rgba.size, '#ffffff')
            base.alpha_composite(rgba)
            return base.convert('RGB'), source_meta
        return fixed.convert('RGB'), source_meta


def luma_summary(image: Image.Image) -> dict:
    thumb = image.copy()
    thumb.thumbnail((512, 512))
    y = thumb.convert('L')
    hist = y.histogram()
    n = sum(hist)
    def percentile(frac):
        mark = n * frac
        total = 0
        for i, value in enumerate(hist):
            total += value
            if total >= mark:
                return i
        return 255
    return {'p10':percentile(.10),'p50':percentile(.50),'p90':percentile(.90),
            'p99':percentile(.99),'near_white_percent':round(100*sum(hist[248:])/n,2),
            'near_black_percent':round(100*sum(hist[:8])/n,2),
            'mean_luma':round(ImageStat.Stat(y).mean[0],2)}


def curve_gamma(image: Image.Image, gamma: float) -> Image.Image:
    if abs(gamma - 1.0) < 1e-8:
        return image.copy()
    ycbcr = image.convert('YCbCr')
    y, cb, cr = ycbcr.split()
    table = [min(255,max(0,round(255 * (i/255) ** gamma))) for i in range(256)]
    adjusted = Image.merge('YCbCr', (y.point(table), cb, cr))
    return adjusted.convert('RGB')


def grade(image: Image.Image, mode: str, strength: float) -> tuple[Image.Image, dict]:
    if mode == 'comparison' or strength == 0:
        return image.copy(), {'mode':mode, 'strength': strength, 'gamma':1.0}
    src_stats = luma_summary(image)
    params = PRESETS[mode]
    # Scene adaptivity; prevents forced brightening of already bright white walls and windows.
    luminance_weight = max(0.0, min(1.0, (170 - src_stats['p50']) / 100))
    white_protection = 0.45 if src_stats['near_white_percent'] > 5 else 1.0
    candidate_gamma = params['gamma_light'] - (params['gamma_light']-params['gamma_dark'])*luminance_weight
    gamma = 1 - (1-candidate_gamma)*white_protection
    gamma = min(1.,max(.89,gamma))
    toned = curve_gamma(image, gamma)
    toned = ImageEnhance.Contrast(toned).enhance(params['contrast'])
    toned = ImageEnhance.Color(toned).enhance(params['color'])
    toned = ImageEnhance.Sharpness(toned).enhance(params['sharpness'])
    warmth = params['warmth']
    if warmth:
        r,g,b = toned.split()
        r = r.point([min(255,max(0,round(i*(1+warmth)))) for i in range(256)])
        b = b.point([min(255,max(0,round(i*(1-warmth)))) for i in range(256)])
        toned = Image.merge('RGB',(r,g,b))
    if strength < 1:
        toned = Image.blend(image, toned, strength)
    return toned, {'mode':mode,'strength':strength,'gamma':round(gamma,5),'scene_p50':src_stats['p50'],
                   'source_near_white_percent':src_stats['near_white_percent'],
                   'source_near_black_percent':src_stats['near_black_percent']}


def valid_rectangles(rectangles, width, height, field='faces'):
    if not isinstance(rectangles,list):
        raise ValueError(f'{field} must be an array')
    pixels = []
    for rect in rectangles:
        if (not isinstance(rect,list) or len(rect)!=4 or
            any(isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) for v in rect)):
            raise ValueError(f'{field}: require finite [x0,y0,x1,y1] normalized rectangles')
        x0,y0,x1,y1 = rect
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            raise ValueError(f'{field}: invalid normalized rectangle {rect}')
        pixels.append((int(x0*width),int(y0*height),max(1,int(x1*width)),max(1,int(y1*height))))
    return pixels


def blur_faces(image: Image.Image, rectangles: list[tuple[int,int,int,int]], ratio=.24) -> Image.Image:
    output = image.copy()
    for x0,y0,x1,y1 in rectangles:
        face_w,face_h = x1-x0,y1-y0
        if face_w<8 or face_h<8:
            raise ValueError('Face box too small for reliable blur; re-review the face rectangle')
        radius = max(8.0,min(90.0,ratio*min(face_w,face_h)))
        feather = max(2,min(face_w,face_h)*.045)
        extra = math.ceil(3*feather + radius)
        bx0,by0 = max(0,x0-extra),max(0,y0-extra)
        bx1,by1 = min(output.width,x1+extra),min(output.height,y1+extra)
        local=output.crop((bx0,by0,bx1,by1))
        matte=Image.new('L',local.size,0)
        draw=ImageDraw.Draw(matte)
        draw.rectangle((x0-bx0,y0-by0,x1-bx0,y1-by0),fill=255)
        matte=matte.filter(ImageFilter.GaussianBlur(feather))
        blurred=local.filter(ImageFilter.GaussianBlur(radius))
        output.paste(Image.composite(blurred,local,matte),(bx0,by0))
    return output


def fit_export(image: Image.Image, label: str) -> Image.Image:
    size=SIZES[label]
    if size is None:
        return image.copy()
    contained=ImageOps.contain(image,size,method=Image.Resampling.LANCZOS)
    backdrop=Image.new('RGB',size,'#f2f1f4')
    backdrop.paste(contained,((size[0]-contained.width)//2,(size[1]-contained.height)//2))
    return backdrop


def export(image: Image.Image, target: Path):
    target.parent.mkdir(parents=True,exist_ok=True)
    # Deterministic re-encoding, stripped EXIF/GPS and no copied ICC profile.
    image.save(target,format='JPEG',quality=94,subsampling=0,optimize=True)
    with Image.open(target) as check:
        check.verify()


def load_annotations(path):
    if not path:
        raise ValueError('--annotations is required for per-photo privacy review')
    obj=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(obj,dict):
        raise ValueError('--annotations expects JSON mapping exact filenames to review records')
    return obj


def validate_annotation(source: Path, annotations: dict, args, width, height):
    row=annotations.get(source.name)
    if not isinstance(row,dict):
        raise ValueError(f'{source.name}: missing per-photo review annotation')
    if row.get('reviewed') is not True:
        raise ValueError(f'{source.name}: reviewed=true required after visual inspection')
    faces=valid_rectangles(row.get('faces',[]),width,height,'faces')
    noface=row.get('no_visible_face') is True
    if faces and noface:
        raise ValueError(f'{source.name}: faces and no_visible_face=true conflict')
    if args.privacy=='blur' and not faces and not noface:
        raise ValueError(f'{source.name}: blur requires reviewed face boxes or no_visible_face=true')
    if args.privacy=='none' and (faces or not noface):
        raise ValueError(f'{source.name}: none requires explicit per-file no_visible_face=true')
    if args.privacy=='keep' and row.get('consent_confirmed') is not True:
        raise ValueError(f'{source.name}: keep requires consent_confirmed=true')
    mode=row.get('mode',args.mode)
    if mode not in PRESETS:
        raise ValueError(f'{source.name}: unknown mode {mode}')
    crop=None
    if 'crop' in row:
        if mode=='comparison':
            raise ValueError(f'{source.name}: comparison forbids cropping')
        if row.get('crop_reviewed') is not True:
            raise ValueError(f'{source.name}: crop_reviewed=true required to protect limbs/equipment')
        boxes=valid_rectangles([row['crop']],width,height,'crop')
        crop=boxes[0]
        if (crop[2]-crop[0])<32 or (crop[3]-crop[1])<32:
            raise ValueError(f'{source.name}: crop region too small')
        for f in faces:
            if not (crop[0]<=f[0] and crop[1]<=f[1] and crop[2]>=f[2] and crop[3]>=f[3]):
                raise ValueError(f'{source.name}: crop would cut a reviewed face box')
    return row, faces, mode, crop


def detect_faces(image: Image.Image) -> list[list[float]]:
    try:
        import cv2
        import numpy as np
    except ImportError as e:
        raise RuntimeError('Face suggestions require opencv-python and numpy') from e
    cascade=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
    if cascade.empty():
        raise RuntimeError('OpenCV face cascade not available')
    gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY)
    hits=cascade.detectMultiScale(gray,scaleFactor=1.1,minNeighbors=5,minSize=(35,35))
    w,h=image.size
    return [[round(x/w,5),round(y/h,5),round((x+bw)/w,5),round((y+bh)/h,5)] for x,y,bw,bh in hits]


def batch(args) -> int:
    if not args.input.is_dir():
        raise ValueError('Missing input directory')
    if args.input.resolve()==args.output.resolve() or args.output.resolve().is_relative_to(args.input.resolve()):
        raise ValueError('Output must be outside the entire input directory')
    sources=sorted(f for f in args.input.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED)
    if not sources:
        raise ValueError('No supported photographs')
    if len({f.stem for f in sources})!=len(sources):
        raise ValueError('Duplicate filename stems would collide')
    ann=load_annotations(args.annotations)
    unknown=set(ann)-{f.name for f in sources}
    if unknown:
        raise ValueError('Unknown files in annotations: '+', '.join(sorted(unknown)))
    manifests=[]
    planned=[]
    args.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.7fit-staging-',dir=args.output.parent) as tmp:
        stage=Path(tmp)
        try:
            for source in sources:
                src_hash=digest(source)
                original,source_meta=read_image(source)
                review, faces, mode, crop=validate_annotation(source,ann,args,*original.size)
                if mode=='comparison' and args.exports!=['original']:
                    raise ValueError(f'{source.name}: comparison requires original export only')
                grade_out,grading=grade(original,mode,args.strength)
                if args.privacy=='blur':
                    grade_out=blur_faces(grade_out,faces,args.blur_ratio)
                if crop:
                    grade_out=grade_out.crop(crop)
                outstat=luma_summary(grade_out)
                exports=[]
                for label in args.exports:
                    suffix='' if label=='original' else '_'+label
                    name=source.stem+'_7fit'+suffix+'.jpg'
                    target=args.output/name
                    if target.exists() and not args.overwrite:
                        raise FileExistsError(f'{target.name} exists; no files committed')
                    image=fit_export(grade_out,label)
                    staged=stage/name
                    export(image,staged)
                    planned.append((staged,target))
                    exports.append({'type':label,'filename':name,'width':image.width,'height':image.height,
                                    'sha256':digest(staged),'framing':('manual-reviewed-crop' if crop else 'original-no-crop') if label=='original' else 'contain-pad'})
                if digest(source)!=src_hash:
                    raise RuntimeError(f'{source.name}: original source changed during processing')
                manifests.append({'filename':source.name,'source_sha256':src_hash,'source_dimensions':list(original.size),
                                  'embedded_icc_warning':source_meta['embedded_icc'],
                                  'mode':mode,'non_generative':True,'body_geometry_locked':True,
                                  'grading':grading,'privacy':args.privacy,'reviewed_annotation':True,
                                  'face_boxes_count':len(faces),'no_visible_face_confirmed':bool(review.get('no_visible_face')),
                                  'manual_crop':bool(crop),'output_luma':outstat,'exports':exports,
                                  'privacy_final_check':'pending_visual_review','safe_to_publish':False})
            # Fail closed: only publish if every source passed privacy, crop, export and hash validation.
            for staged,target in planned:
                os.replace(staged,target)
            manifest={'schema_version':'1.1','editor':'7fit-photo-retouching','processing':'non-generative',
                      'successful':len(manifests),'failed':0,'results':manifests,'errors':[],
                      'review_required':True,'safe_to_publish':False,
                      'note':'Outputs require human check of all faces/profiles, body contours, brand text, anatomy, composition and export. Do not publish solely on this manifest.'}
            (args.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps({'successful':len(manifests),'failed':0,'manifest':str(args.output/'manifest.json'),
                              'review_required':True},ensure_ascii=False))
            return 0
        except (OSError,RuntimeError,ValueError,UnidentifiedImageError) as e:
            failure={'schema_version':'1.1','editor':'7fit-photo-retouching','processing':'non-generative',
                     'successful':0,'failed':1,'results':[],
                     'errors':[{'error':str(e)}], 'review_required':True,'safe_to_publish':False,
                     'note':'FAIL CLOSED: staged outputs discarded; input files unchanged. Existing outputs (if any) untouched.'}
            (args.output/'manifest.json').write_text(json.dumps(failure,ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'ERROR: {e}',file=sys.stderr)
            return 1


def main(argv=None) -> int:
    p=argparse.ArgumentParser(description='7Fit V1.1 deterministic non-generative photo retouch')
    sub=p.add_subparsers(dest='command',required=True)
    inspect=sub.add_parser('inspect',help='source integrity and tone inspection')
    inspect.add_argument('source',type=Path)
    suggest=sub.add_parser('suggest-faces',help='UNREVIEWED OpenCV suggestion JSON; never an approval')
    suggest.add_argument('--input',type=Path,required=True)
    suggest.add_argument('--output-json',type=Path,required=True)
    batch_cmd=sub.add_parser('batch',help='fail-closed batch exports using reviewed annotations')
    batch_cmd.add_argument('--input',type=Path,required=True)
    batch_cmd.add_argument('--output',type=Path,required=True)
    batch_cmd.add_argument('--mode',choices=PRESETS,default='course')
    batch_cmd.add_argument('--privacy',choices=['blur','keep','none'],required=True)
    batch_cmd.add_argument('--annotations',type=Path,required=True)
    batch_cmd.add_argument('--exports',nargs='+',choices=SIZES,default=['original'])
    batch_cmd.add_argument('--strength',type=float,default=.85,help='0..1 restrained photographic grading')
    batch_cmd.add_argument('--blur-ratio',type=float,default=.24,help='Gaussian radius / face min dimension')
    batch_cmd.add_argument('--overwrite',action='store_true')
    args=p.parse_args(argv)
    try:
        if args.command=='inspect':
            im,meta=read_image(args.source)
            print(json.dumps({'filename':args.source.name,'dimensions':list(im.size),
                              'sha256':digest(args.source),'source_metadata':meta,'luma':luma_summary(im)},ensure_ascii=False,indent=2))
            return 0
        if args.command=='suggest-faces':
            if not args.input.is_dir():
                raise ValueError('Input directory unavailable')
            items={}
            for src in sorted(args.input.iterdir()):
                if src.is_file() and src.suffix.lower() in SUPPORTED:
                    im,_=read_image(src)
                    items[src.name]={'faces':detect_faces(im),'reviewed':False,'no_visible_face':False,
                                     'comment':'SUGGESTION ONLY: manually inspect front/profile/three-quarter faces'}
            args.output_json.parent.mkdir(parents=True,exist_ok=True)
            args.output_json.write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
            print(f'UNREVIEWED suggestions: {args.output_json}')
            return 0
        if not 0<=args.strength<=1:
            raise ValueError('--strength must be [0,1]')
        if not .10<=args.blur_ratio<=.70:
            raise ValueError('--blur-ratio must be [.10,.70]')
        return batch(args)
    except (OSError,RuntimeError,ValueError,UnidentifiedImageError) as e:
        print(f'ERROR: {e}',file=sys.stderr)
        return 2


if __name__=='__main__':
    sys.exit(main())