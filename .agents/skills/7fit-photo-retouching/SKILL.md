---
name: 7fit-photo-retouching
description: 7Fit 场馆摄影后期专属流程。用于私教课程纪实、健身馆空间、会员案例、体态对比、照片调色、自然人像修图、隐私模糊和社交平台批量导出；优先非生成式修图并严格保护原图、人体形态与会员隐私。
---

# 7Fit Photo Retouching · V1

## Core outcome

Deliver realistic, clean, bright-but-not-flat, natural and premium 7Fit photographs. Preserve each original byte-for-byte. Keep people recognizably themselves; do not beautify by altering faces, limbs, proportions or training outcomes. Process multiple sources into **independent** outputs, never a collage unless explicitly requested.

## Mandatory workflow

1. **Intake and classify.** Inspect the actual image at full resolution, identify `course`, `venue`, `portrait`, or `comparison`. If supplied multiple images, identify their individual contexts. Do not imply that a brightness statistic is semantic scene recognition. Ask only for information that is genuinely blocking (e.g., ambiguous consent for publishing identifiable member faces).
2. **Protect the source.** Keep originals in a separate directory. Record dimensions, orientation and SHA-256. Never overwrite inputs; treat filenames, GPS/EXIF and member identities as sensitive. Prefer local/offline execution.
3. **Choose least-destructive method.** Default to deterministic photographic development (tonal exposure, white balance, highlight/shadow handling, gentle color and texture). Use `scripts/retouch.py` for a dependency-light, reproducible baseline. For RAW/XMP grading, where **installed and verified**, delegate to `photo-xmp-editing` (`https://github.com/f1shh/my-skills`). Never claim its CLI is bundled here.
4. **Identity-safe local fixes.** For approved object/background removal requiring synthesis, route to `identity-safe-photo-retouching` (`https://github.com/Sancerio/codex-photo-editing-skills`) or official Codex `imagegen` **only when available**. Use a small, inspected region mask; preserve protected people and scene pixels outside the mask. Do not generate a replacement entire frame for simple lighting. If the environment lacks tools, stop that stage and offer the deterministic result. Never fabricate a mask, segment body parts approximately, or claim pixel-exact identity for a full-frame generated edit.
5. **Member privacy.** Faces seen front/side/three-quarter are privacy-sensitive. Default to privacy review for any member `course` or `comparison` image. For `--privacy blur`, provide **reviewed normalized face boxes per filename**; or use optional OpenCV detection as *suggestions only*, followed by manual review. Never declare no faces solely because a detector finds none. Back-facing people with no visible face need explicit visual confirmation. No external AI upload without clear user authorization.
6. **Evidence-specific mode.** For body-change/physique, posture, measurement and training before/after comparisons, lock anatomy: prohibit generative pixels, slimming, limb length changes, contour warps, shape manipulation, perspective correction that changes measured proportions, and inconsistent crops/angles. Default `comparison` preset is neutral (all image adjustments at 1.0). Require consent and verified consistent conditions before reporting change as fact.
7. **Export and audit.** Provide a separate full-resolution original-ratio JPEG for each source. Social 4:5/9:16 variants are *contain/pad*, not hidden crops that amputate a person. Explicitly disclose framing margins. Always record source+output hashes, method, number of blurred face boxes, final dimensions, errors and review status in `manifest.json`; visually check every final at full size. JPEG removes EXIF by default; do not promise deletion from originals.

## Simple local command

Install `python -m pip install Pillow`, then:

```bash
python scripts/retouch.py inspect input/photo.jpg
python scripts/retouch.py batch --input input --output output --mode venue --exports original 4x5
```

For identifiable member photos, **explicit privacy choice required**. Example with manually reviewed boxes:

```bash
python scripts/retouch.py batch --input input --output output --mode course \
  --privacy blur --face-boxes face-boxes.json --exports original 4x5 9x16
```

`face-boxes.json` contains per-file normalized rectangles (0–1 coordinates):

```json
{"photo.jpg": [[0.41, 0.10, 0.57, 0.29]]}
```

Optional face suggestions: `--detect-faces` requires `opencv-python` plus `numpy`, and does not remove the final manual review obligation. For a knowingly face-free set use `--no-visible-faces-confirmed` **after manually inspecting** images. If user explicitly consents to visible faces, pass `--privacy keep` for member modes.

## Quality bar and stop conditions

- Compare the photo against the original, including 100% zoom on skin, face, logo, gym machines, hands and text.
- Reject neon/oversaturated skin, crushed blacks, blown shirts/walls, waxy skin, exaggerated muscles, unnatural abdominal definition, cloned people, warped equipment, and unreadable 7Fit logo.
- Never substitute synthetic imagery for documentary body-change evidence. Never report that faces are fully anonymized on automatic detection alone.
- If batch reports failures, deliver no blanket statement of success. Refer to failed entries and `review_required` in manifest.
- Distinguish **implemented in this package:** deterministic JPG edits, manually annotated face blur, optional heuristic OpenCV boxes, non-destructive batch exports and manifest; **external integration only:** darktable XMP, true semantic masks, imagegen localized inpainting, RAW processing, fully automated face identification.

For details and limitations, read `references/implementation.md` before operating at scale.