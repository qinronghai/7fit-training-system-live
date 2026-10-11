# 7Fit photo-retouching integration and validation

## Scope V1

- Works with JPEG/PNG/WebP/TIFF inputs Pillow can decode; exports full-resolution, original-ratio JPEG (orientation normalized) and optional padded JPEG 1200×1500 or 1080×1920.
- Only works on files in the given immediate input directory (no recursive traversal).
- Uses simple, intentionally restrained fixed color presets; these are a **baseline**, not expert color matching or full RAW processing. The presets do not adaptively determine white balance, tone curves or skin mask.
- Preserves input file bytes; output JPEG omits original EXIF/GPS and may lose color profiles. Inspect color-managed output before publishing. Avoid evidence usage where ICC color accuracy is critical without separate validation.
- `comparison` bypasses any visual corrections, so the exported JPEG is re-encoded but image geometry remains unchanged. This is not a calibrated clinical measurement system.
- Pillow mode does not implement background object removal, smart person selection or face detection itself. `--detect-faces` may leverage an installed frontal-face OpenCV Haar cascade, which misses profile, small and obscured faces. Always visually review.
- Face blur is a rectangular local Gaussian blur, not advanced semantic segmentation. Boxes must be chosen large enough to obscure identifiable facial features. Full anonymity is not guaranteed; clothing/background/context can identify people.
- Output manifest logs each file source SHA256, output SHA256 and photo metadata, output dimensions, privacy workflow and review flag. Manifest may contain sensitive filenames; keep private.

## Integrations (not bundled)

**Non-generative grading**: https://github.com/f1shh/my-skills/tree/main/photo-xmp-editing . Requires darktable, `photo-xmp`, and further toolchain. Route task to that skill if installed and if detailed XMP/RAW workflow is useful; read its local SKILL.md and license first.

**Identity-safe localized editing**: https://github.com/Sancerio/codex-photo-editing-skills/tree/main/skills/identity-safe-photo-retouching . Can be used separately for precise mask/pixel preservation. This package does not vendor its code.

**OpenAI imagegen**: https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md . Use built-in tool where supported for *authorized* local generative edits. Treat all such outputs as generative and mark accordingly; they are never documentary posture/physique evidence.

## Installation

1. This folder belongs at `<repo>/.agents/skills/7fit-photo-retouching` for repository-scoped discovery in supported Codex environments. Skills availability may vary by Codex client and version; use explicit SKILL.md reference if auto-discovery fails.
2. Install Pillow in your environment: `python -m pip install Pillow`. Optional `python -m pip install opencv-python numpy` for heuristic detection.
3. Run `python -m unittest discover -s tests -v` from this skill directory.
4. Place photos under an ignored local input directory **outside this public repository**. Never commit member photos, facial coordinates, manifests, or outputs.

## Acceptance tests

- Output never overwrites original; SHA256 unchanged before and after.
- JPEG exports decode; dimension/manifests match actual file; GPS/EXIF removed.
- Course/comparison require explicit `--privacy` decision; blur requires reviewed boxes or a detection attempt, and zero detections require manual no-face confirmation.
- A batch with image errors returns non-zero with per-file failure record; no false all-clear.
- Comparison prohibits non-neutral brightness and transformed format export.
- Test cases: standard RGB image, normalized manual face box, invalid box, duplicates, no face metadata, source unchanged, output collision, 4:5 and 9:16 padded dimensions.