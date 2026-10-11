#!/usr/bin/env python3
"""7Fit deterministic photo grading, face privacy, conservative exports, and evidence manifests.

Dependency: Pillow. Optional: OpenCV for heuristic face-box suggestions.
Do not use this module for generation or body reshaping.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

SUPPORTED = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'}
PRESETS = {
    'course': {'brightness': 1.08, 'contrast': 1.04, 'color': 1.03, 'sharpness': 1.04, 'warmth': 0.005},
    'venue': {'brightness': 1.09, 'contrast': 1.05, 'color': 1.02, 'sharpness': 1.05, 'warmth': -0.005},
    'portrait': {'brightness': 1.06, 'contrast': 1.02, 'color': 0.99, 'sharpness': 1.00, 'warmth': 0.007},
    'comparison': {'brightness': 1.00, 'contrast': 1.00, 'color': 1.00, 'sharpness': 1.00, 'warmth': 0.000},
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


def read_image(path: Path) -> Image.Image:
    with Image.open(path) as opened:
        if opened.width * opened.height > MAX_PIXELS:
            raise ValueError(f'Image exceeds {MAX_PIXELS} pixels: {path}')
        opened.load()
        fixed = ImageOps.exif_transpose(opened)
        if fixed.mode in ('RGBA', 'LA') or (fixed.mode == 'P' and 'transparency' in fixed.info):
            rgba = fixed.convert('RGBA')
            base = Image.new('RGBA', rgba.size, '#ffffff')
            base.alpha_composite(rgba)
            return base.convert('RGB')
        return fixed.convert('RGB')


def stats(image: Image.Image) -> dict:
    preview = image.copy()
    preview.thumbnail((512, 512))
    mean = ImageStat.Stat(preview).mean
    return {'mean_rgb': [round(v, 1) for v in mean], 'mean_luma_approx': round(sum(m*w for m,w in zip(mean,(.2126,.7152,.0722))),1)}


def grade(image: Image.Image, settings: dict) -> Image.Image:
    out = ImageEnhance.Brightness(image).enhance(settings['brightness'])
    out = ImageEnhance.Contrast(out).enhance(settings['contrast'])
    out = ImageEnhance.Color(out).enhance(settings['color'])
    out = ImageEnhance.Sharpness(out).enhance(settings['sharpness'])
    warmth = settings['warmth']
    if warmth:
        r, g, b = out.split()
        r = r.point([min(255, max(0, round(i * (1 + warmth)))) for i in range(256)])
        b = b.point([min(255, max(0, round(i * (1 - warmth)))) for i in range(256)])
        out = Image.merge('RGB', (r, g, b))
    return out


def valid_boxes(boxes: list, width: int, height: int) -> list[tuple[int, int, int, int]]:
    result = []
    for box in boxes:
        if not isinstance(box, list) or len(box) != 4 or any(isinstance(n,bool) or not isinstance(n,(int,float)) for n in box):
            raise ValueError('Face boxes must be [x0,y0,x1,y1] numeric normalized coordinates')
        x0,y0,x1,y1 = box
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            raise ValueError(f'Face box out of bounds: {box}')
        px = (int(x0*width), int(y0*height), max(int(x0*width)+1,int(x1*width)), max(int(y0*height)+1,int(y1*height)))
        result.append(px)
    return result


def detect_faces(image: Image.Image) -> list[list[float]]:
    try:
        import cv2
        import numpy as np
    except ImportError as e:
        raise RuntimeError('OpenCV face detection requires opencv-python and numpy; supply reviewed --face-boxes instead') from e
    xml_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    detector = cv2.CascadeClassifier(xml_path)
    if detector.empty():
        raise RuntimeError('OpenCV frontal face cascade is unavailable')
    rgb = np.asarray(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    boxes = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(35,35))
    w,h = image.size
    return [[round(x/w,6),round(y/h,6),round((x+bw)/w,6),round((y+bh)/h,6)] for x,y,bw,bh in boxes]


def blur_boxes(image: Image.Image, boxes: list[tuple[int,int,int,int]], radius: float) -> Image.Image:
    out = image.copy()
    for box in boxes:
        # Gaussian is applied only to the rectangular region; outside pixels stay unchanged.
        crop = out.crop(box)
        blurred = crop.filter(ImageFilter.GaussianBlur(radius=radius))
        out.paste(blurred, box[:2])
    return out


def fit_export(image: Image.Image, label: str) -> Image.Image:
    size = SIZES[label]
    if size is None:
        return image.copy()
    scaled = ImageOps.contain(image, size, method=Image.Resampling.LANCZOS)
    backdrop = Image.new('RGB', size, '#f2f1f4')
    backdrop.paste(scaled, ((size[0]-scaled.width)//2, (size[1]-scaled.height)//2))
    return backdrop


def export(image: Image.Image, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.stem + '.partial' + target.suffix)
    image.save(tmp, format='JPEG', quality=93, subsampling=0, optimize=True)  # strip EXIF/GPS by default
    os.replace(tmp, target)
    with Image.open(target) as verify:
        verify.verify()


def load_boxmap(path: str | None) -> dict:
    if not path:
        return {}
    obj = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(obj, dict):
        raise ValueError('--face-boxes expects JSON object mapping exact filenames to arrays of boxes')
    return obj


def process_one(source: Path, output: Path, args: argparse.Namespace, boxmap: dict) -> dict:
    src_hash = digest(source)
    original = read_image(source)
    mode = args.mode
    if mode in ('course','comparison') and args.privacy is None:
        raise ValueError(f'{mode}: explicitly choose --privacy blur or keep; never assume consent')
    preset = dict(PRESETS[mode])
    if args.brightness is not None:
        preset['brightness'] = args.brightness
    if mode == 'comparison':
        if args.brightness is not None and args.brightness != 1.0:
            raise ValueError('comparison: no brightness changes allowed in evidence mode')
        if args.exports != ['original']:
            raise ValueError('comparison: only original aspect/dimensions allowed')
    graded = grade(original, preset)
    proposed = boxmap.get(source.name)
    found_via = None
    face_boxes = []
    if args.privacy == 'blur':
        if proposed is not None:
            if not isinstance(proposed,list):
                raise ValueError(f'Invalid list of face boxes for {source.name}')
            face_boxes = proposed
            found_via = 'user-specified'
        elif args.detect_faces:
            face_boxes = detect_faces(original)
            found_via = 'opencv-suggestion'
        else:
            raise ValueError(f'{source.name}: provide --face-boxes or --detect-faces when privacy=blur')
        if not face_boxes and not args.no_visible_faces_confirmed:
            raise ValueError(f'{source.name}: no faces identified; user must confirm --no-visible-faces-confirmed after visual review')
        boxes_px = valid_boxes(face_boxes, *original.size)
        graded = blur_boxes(graded, boxes_px, radius=args.blur_radius)
    elif args.privacy == 'keep':
        found_via = 'explicit-keep'
    exports = []
    for label in args.exports:
        final = fit_export(graded, label)
        suffix = '' if label == 'original' else '_' + label
        target = output / (source.stem + '_7fit' + suffix + '.jpg')
        if target.resolve() == source.resolve():
            raise ValueError('Will not overwrite source')
        if target.exists() and not args.overwrite:
            raise FileExistsError(f'{target} exists; use a new output folder or --overwrite')
        export(final, target)
        exports.append({'type':label,'path':str(target),'width':final.width,'height':final.height,'sha256':digest(target)})
    if digest(source) != src_hash:
        raise RuntimeError(f'SOURCE CHANGED DURING PROCESSING: {source}')
    return {
        'source':str(source), 'source_sha256':src_hash, 'source_dimensions':list(original.size),
        'mode':mode, 'non_generative':True, 'preset':preset, 'privacy':args.privacy or 'not_requested',
        'privacy_review_required': args.privacy == 'blur',
        'face_box_origin': found_via, 'face_boxes_count':len(face_boxes),
        'warning': 'Face detectors can miss side/back/obscured faces. Review every exported image.' if args.privacy == 'blur' else None,
        'source_stats':stats(original),'output_stats':stats(graded), 'exports':exports,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='7Fit V1 conservative non-generative photo retouching')
    sub = parser.add_subparsers(dest='command',required=True)
    inspect = sub.add_parser('inspect',help='read-only image attributes and statistics')
    inspect.add_argument('source',type=Path)
    batch = sub.add_parser('batch',help='process image files, one output per image/aspect')
    batch.add_argument('--input',required=True,type=Path)
    batch.add_argument('--output',required=True,type=Path)
    batch.add_argument('--mode',required=True,choices=PRESETS)
    batch.add_argument('--privacy',choices=['blur','keep'],default=None)
    batch.add_argument('--face-boxes',help='JSON: {"photo.jpg": [[.1,.2,.3,.4]]}')
    batch.add_argument('--detect-faces',action='store_true',help='OpenCV heuristic suggestions, must review outputs')
    batch.add_argument('--no-visible-faces-confirmed',action='store_true',help='Explicit manual visual review of no faces')
    batch.add_argument('--blur-radius',type=float,default=25)
    batch.add_argument('--brightness',type=float,help='optional manual override; except comparison evidence mode')
    batch.add_argument('--exports',nargs='+',choices=SIZES,default=['original'])
    batch.add_argument('--overwrite',action='store_true')
    args = parser.parse_args(argv)
    try:
        if args.command == 'inspect':
            image = read_image(args.source)
            print(json.dumps({'source':str(args.source),'width':image.width,'height':image.height,'sha256':digest(args.source),'stats':stats(image)},ensure_ascii=False,indent=2))
            return 0
        if not args.input.exists() or not args.input.is_dir():
            raise ValueError('--input must be an existing directory')
        if args.blur_radius <= 0 or args.blur_radius > 100:
            raise ValueError('--blur-radius must be between 0 and 100')
        if args.brightness is not None and not (0.85 <= args.brightness <= 1.20):
            raise ValueError('--brightness override must be in [0.85,1.20]')
        if args.privacy == 'keep' and args.detect_faces:
            raise ValueError('--detect-faces only applies to --privacy blur')
        images = sorted(p for p in args.input.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED)
        if not images:
            raise ValueError('No supported images found')
        if args.output.resolve() == args.input.resolve():
            raise ValueError('Output directory must differ from input directory')
        # Prevalidate privacy settings to avoid partial execution for the common unsafe case.
        if args.mode in ('course','comparison') and args.privacy is None:
            raise ValueError('Explicit --privacy blur or keep is required for member photos')
        boxmap = load_boxmap(args.face_boxes)
        if args.privacy == 'blur' and not args.detect_faces:
            missing = [p.name for p in images if p.name not in boxmap]
            if missing:
                raise ValueError('Missing face-box annotations: ' + ', '.join(missing))
        if len({p.stem for p in images}) != len(images):
            raise ValueError('Duplicate stems across input extensions; rename sources to prevent output collision')
        results, errors = [], []
        args.output.mkdir(parents=True,exist_ok=True)
        for source in images:
            try:
                results.append(process_one(source,args.output,args,boxmap))
            except (OSError,ValueError,RuntimeError,UnidentifiedImageError) as e:
                errors.append({'file':str(source),'error':str(e)})
        manifest = {'schema_version':'1.0', 'editor':'7fit-photo-retouching',
                    'successful':len(results),'failed':len(errors),'results':results,'errors':errors,
                    'review_required':bool(errors) or any(row['privacy_review_required'] for row in results),
                    'note':'Batch status is not proof of identity or privacy completeness; check every photograph at full size.'}
        manifest_path = args.output / 'manifest.json'
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'manifest':str(manifest_path),'successful':len(results),'failed':len(errors),'review_required':manifest['review_required']},ensure_ascii=False))
        return 1 if errors else 0
    except (OSError,ValueError,RuntimeError,UnidentifiedImageError) as e:
        print(f'ERROR: {e}',file=sys.stderr)
        return 2

if __name__ == '__main__':
    sys.exit(main())