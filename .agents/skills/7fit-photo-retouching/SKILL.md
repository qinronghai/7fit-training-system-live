---
name: 7fit-photo-retouching
description: 7Fit 场馆原片保真修图 v1.1。用于训练纪实、场馆摄影、自然人像及体态案例照片的非生成式调色、单张批量处理、经确认的人脸高斯模糊、可审查构图裁切与隐私质检。优先使用原始像素，禁止改变会员形态和器械文字。
---

# 7Fit Photo Retouching · V1.1 (2026-10-12)

## When to use

Use for any 7Fit gym photo whose purpose is to document **real** training, member progress, venue interiors or classes. Desired look: **真实、干净、明亮、柔和、自然、通透、专业、克制、女性友好**. Independent full-quality files, not mosaics or collages.

## Critical correction from real-photo V1 trial

The previous chat trial used **full-frame image generation**, not V1's non-generative Python pipeline. Those visually appealing outputs are **not pixel-faithful revisions**: text on walls and equipment, background objects, proportions, person details or exact exercise moments can drift. A plausible regenerated photograph must not be called an authentic retouched original. **V1.1 mandates actual source-file processing first.** Do not use image generation as a silent fallback for a documentary request. If a user expressly asks for creative generative edits, use a separate labelled workflow and never pass it off as unaltered training evidence.

## Fidelity and privacy invariants (P0)

1. **Source preservation:** keep input files unchanged; SHA-256 before and after. Keep member photos, reviews and exports out of public repositories and unapproved cloud services. Inspect actual image pixels (not just text descriptions).
2. **No shape editing:** do not reshape muscles, torso, waist, limbs, pelvic alignment, spine posture, clothing, weights, tools, logos, wall lettering, room geometry or exercise mechanics. No artificial ab definition, face replacement, anatomy correction or recreated gym details.
3. **Photo-first / non-generative:** default to Pillow/darktable-based exposure, tone curves, modest white-balance and restrained texture enhancement. V1.1 local renderer has **no object-removal/semantic-mask/generative modules**; never describe those as implemented. External `photo-xmp-editing` can be used only if actually installed/tested. Natural tone enhancement is not targeted body editing.
4. **No identity disclosure:** front, three-quarter and profile faces require manually inspected face regions. Rear-view images can be marked `no_visible_face:true` only after visual inspection. A face detector finding zero faces does **not** imply no face. Blurring faces does not guarantee anonymity: background, clothing and context can still identify a member. Never auto-publish.
5. **Per-file privacy gate:** for every photograph, an annotation entry with `reviewed:true` and either face boxes, `no_visible_face:true`, or explicit `consent_confirmed:true` for intentional face retention. No batch-wide no-face waiver. OpenCV provides candidates only; the generated suggestion file is always `reviewed:false` and cannot be directly used to export.
6. **Conservative crop:** preserve original full-framing by default. 4:5 and 9:16 versions use contain/pad to avoid hidden amputation. A user-authorized optional crop requires a *per-photo reviewed rectangle* and full-frame/edge check so no arm, feet, weights, barbells, mat or evidence landmarks are cropped. Human silhouette alone is insufficient: respect exercise context.
7. **Comparison evidence:** `comparison` mode disables grade transformations, generative edits, perspective deformation and cropping; exports only original-size JPEG (re-encoded). Comparable camera angle, lens, stance and lighting still need independent validation. Never claim measurable posture improvements from these exports alone.
8. **Fail-closed batch:** a single unreadable image, invalid privacy note or forbidden crop causes *zero new batch JPGs* to be published. Staged work is discarded. Manifest is never publication clearance; verify every output visually at full size before distributing it.

## Default workflow

1. Review each original: identify its exact `course / venue / portrait / comparison` mode; inspect crop edges, lighting, background distractions, visible front/side faces and sensitive member context. Make a per-file annotation JSON; never infer `reviewed:true` from automated face detection. If labels are unknown ask for clarification.
2. Read source integrity and light levels with `python scripts/retouch.py inspect /private/photo.jpg`. Source ICC profiles are detected, but V1.1's basic JPG renderer does **not** color-manage AdobeRGB/other ICC spaces; stop or use a color-managed tool when exact color is critical.
3. Prepare one local JSON review record **per exact filename**. Example of mixed back and front member photos:

   ```json
   {
     "back.jpg": {"mode":"course","reviewed":true,"no_visible_face":true},
     "front.jpg": {"mode":"course","reviewed":true,"faces":[[0.42,0.17,0.57,0.32]]}
   }
   ```

   Face rectangles `[left,top,right,bottom]` are fractions of the **orientation-normalized original**. They are face-privacy zones, not identity recognition. Boxes must cover eyes, nose, mouth, side profile and chin. For a genuinely face-free scene choose `--privacy none` and `no_visible_face:true` on **every** file. For an allowed unblurred visible face choose `--privacy keep` plus `consent_confirmed:true` on every photo; this field records operator confirmation, not technical proof of consent.
4. Run the **deterministic renderer**, starting with a modest grade:

   ```bash
   python scripts/retouch.py batch --input /private/7fit-photos \
     --output /private/7fit-reviewed-exports --mode course \
     --privacy blur --annotations /private/photo-review.json \
     --strength 0.85 --exports original 4x5
   ```

   - `--privacy blur`: protects manually reviewed face boxes, permits reviewed `no_visible_face:true` for back view.
   - `--privacy none`: requires every photo reviewed as having **no visible face**; does not blur.
   - `--privacy keep`: requires per-photo `consent_confirmed:true` (use only with proper permission).
   - For mixed image classes, write `"mode":"venue"` or another valid class per annotation, overriding batch default.
   - For a **verified safe crop**, include `"crop":[0.05,0.02,0.94,0.98],"crop_reviewed":true`; do not auto-crop body, equipment or brand signs.
   - To obtain OpenCV **unreviewed suggestions**, use `python scripts/retouch.py suggest-faces --input /private/7fit-photos --output-json /private/suggestions.json`; then manually inspect/edit annotations. Profiles are often missed.
5. Compare originals and actual exported files at 100%: no blown window/white shirt; skin natural; black floor and black pants retain detail; recognizable hair, posture, clothing, equipment, labels, weights, wall logo and perspective; no cropped body/weights; faces properly obscured. If unsafe or off-style, revise and re-export. Do not imply a JSON review field or a model's label certifies anonymity.
6. Deliver **separate images** and a brief honest QC note; keep local `manifest.json` private because names/metadata are sensitive. Each record has SHA, pixel dimensions, scene grading, face box count, crop status and **`safe_to_publish:false`** until actual manual approval. ZIP is optional for user convenience only; outputs themselves remain standalone images.

## V1.1 limits

- Pillow tonal curve is global, adaptive to simple brightness statistics and not a semantic subject lighting adjustment, precise RAW develop, color-managed workflow, skin selection or localized background cleaning.
- Manual masks require human-reviewed coordinates; Gaussian blur does not guarantee complete anonymization, especially a side face, mirrored face, tattoo or background identity.
- `--strength 0` yields no tonality change before JPEG re-encoding (pixel RGB values can still shift from JPEG compression); `comparison` output remains a JPEG derivative, not the original bytes.
- Image generation and darktable/XMP are **not integrated into this Python package**. Generative photo editing needs independent explicit authorization and source-locked masks, plus disclosure.

Read `references/implementation.md`, `references/real-photo-review.md` for examples, risk boundaries and acceptance tests before large member batches.