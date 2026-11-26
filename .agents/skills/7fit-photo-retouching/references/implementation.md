# 7Fit Photo Retouching V1.2 — workflow contract

V1.2 introduces a user-approved aesthetic standard and **engine routing**; the checked-in `scripts/retouch.py` remains the **tested V1.1 local, non-generative renderer**. Adding this reference does not install, configure, or verify a native generative backend in Codex.

## Editorial vs evidence decision

- `EDITORIAL_ENHANCE`: social media course photo / gym marketing / portrait. Authorized image-generation/editing tool preferred to obtain a clean, bright, naturally lit premium appearance **only after source & consent checks**. Prefer mask-constrained edits, maintain source fidelity, compare results. Use the V1.1 renderer or installed darktable for source-only fallback.
- `DOCUMENTARY_LOCKED`: real teaching/medical-ish movement recording. The original composition, anatomy, load, camera geometry and equipment remain source-aligned. Use deterministic/non-generative editing.
- `EVIDENCE_LOCKED`: posture and progress/before-after photos. No generation, body retouch, recomposition or misleading comparative grading.
- `CREATIVE_COMPOSITE`: expressly requested montage, poster or stylization; keep a separate labeled creative deliverable, never claim documentary fidelity.

## Consent / privacy / quality gates

Do not upload identifiable members to unknown or unapproved cloud model endpoints. A consent to publish is not necessarily consent to third-party model processing. Source-lock instructions cannot guarantee generative face/body identity; manual comparison against original is mandatory. Apply final privacy masking as a separate deterministic step when a face is visible; inspect full/side/reflected faces and contextual identification. Human-reviewed `safe_to_publish` clearance is never implied by a successful command.

## Existing deterministic CLI (unchanged)

The existing tested V1.1 code requires Python 3.10+, Pillow, optionally OpenCV + numpy for *unreviewed frontal face suggestions*. It handles original SHA, EXIF orientation, per-file annotations, bounded global grading, manually reviewed crops, blur and independent JPEG variants. It cannot do generative image editing, semantic masks, object removal or true RAW/XMP color management. See the preserved V1.1 implementation below for exact commands.

---

## Legacy V1.1 local renderer — exact setup and limits
## Dependencies

- Python 3.10+ (uses `Path.is_relative_to`), Pillow (`python -m pip install Pillow`).
- Optional `opencv-python`, `numpy` **only for suggesting frontal face bounding rectangles**, never for bypassing manual review.
- No network calls and no credential settings. Never upload private member photos to a public git repository or unapproved image API.

## Commands

```bash
# Inspect the exact source file without changing it
python scripts/retouch.py inspect /private/photos/001.jpg

# Produce a UNREVIEWED draft JSON (optional)
python scripts/retouch.py suggest-faces --input /private/photos --output-json /private/draft-faces.json

# After inspecting and writing privacy annotations, render independently
python scripts/retouch.py batch --input /private/photos --output /private/exports \
  --mode course --privacy blur --annotations /private/face-review.json \
  --strength 0.85 --exports original 4x5 9x16

python -m unittest discover -s tests -v
```

## Annotation schema

Per filename after EXIF orientation is applied. All coordinates normalized 0..1:

```json
{
  "001.jpg": {
    "mode": "course",
    "reviewed": true,
    "faces": [[0.42, 0.13, 0.59, 0.29]],
    "crop": [0.03, 0.05, 0.96, 0.95],
    "crop_reviewed": true
  },
  "002.jpg": {"mode":"course","reviewed":true,"no_visible_face":true},
  "003.jpg": {"mode":"venue","reviewed":true,"no_visible_face":true}
}
```

Use `--privacy none` only if *every* image declares no visible face; `--privacy keep` requires `consent_confirmed:true` in *every* annotation (record-keeping, not technical consent proof). For one batch with both people showing faces and backs use `--privacy blur` and give either boxes or an explicitly confirmed no-visible-face entry for each image.

## Processing

- Orientation correction happens first via Pillow EXIF transpose. Inputs are never overwritten. Color is converted into RGB. Source ICC presence is logged; conversion does not implement correct source-to-sRGB ICC handling. Use darktable/LittleCMS-based workflow when critical.
- Adaptive monochrome luminance gamma curve on the Y channel tends to open midtones while preserving endpoints. The curve is bounded by `gamma_dark`/`gamma_light`, histogram p50 and a near-white protection weight. Tiny restrained contrast/color/sharpness changes are then blended by `--strength`.
- Restraint is intentional. This is global enhancement rather than the precise local masking/tonal hierarchy from external photo-xmp skills.
- Face masking is deliberately manual and image-relative. Gaussian radius scales with face size and the rectangular mask is softly feathered. Blur quality/coverage must be checked by a person.
- Original export retains native pixel dimensions except a **reviewed** crop. `4x5` and `9x16` use contain/pad, not destructive auto-crop. Re-encoded JPEG omits EXIF/GPS; metadata hash/format/dimensions are recorded locally.
- Before all input images pass validation, outputs exist only in a temporary staging directory outside source. On an error, staged JPGs are discarded and a manifest explains why. Existing target JPGs are never touched unless the user explicitly chooses `--overwrite`; all-or-nothing commit is best-effort across filesystem operations and not a hardware-level transaction.
- `manifest.json` reports `review_required:true` and `safe_to_publish:false` even on success. Automated tests cover software behavior, not human privacy approval, photo aesthetics or member consent.

## Change log

- **V1.1** (2026-10-12): explicitly rejects the previous whole-frame generative photo editing workflow for documentary evidence; reviewed per-file face annotations and consent; fail-closed multi-photo staging; crop review; mixed per-image scene modes; adaptive luminance/highlight protection; size-relative feathered Gaussian blur; 20 regression checks; source material audit.
- **V1.0**: 4 basic modes, fixed brightness multipliers, basic rectangular face blur, optional heuristic direct face-detection in batch, per-source SHA/EXIF stripping and per-file JPEG variants. The old global no-face waiver is deprecated.

## External tools — optional, not bundled

- `photo-xmp-editing`: https://github.com/f1shh/my-skills/tree/main/photo-xmp-editing (darktable/photo-xmp RAW/XMP); install/validate separately.
- `identity-safe-photo-retouching`: https://github.com/Sancerio/codex-photo-editing-skills/tree/main/skills/identity-safe-photo-retouching (local composite masks, separate).
- Official Codex image generation: https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md . Use only upon express generative brief, mark output as generated, never mislabel it as faithful retouch/evidence.

## Privacy and model risk

The CLI is not a consent-management service. It cannot detect all identities, distinguish private from public scenes, or guarantee reliable deidentification. Blur photos locally and visually check exposed skin, identifiable reflections, clothing and location context prior to sharing externally.