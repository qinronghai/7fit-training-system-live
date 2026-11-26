---
name: 7fit-photo-retouching
description: 7Fit 摄影美学 V1.2：为课程纪实、健身馆空间、会员人像和社交平台提供通透自然的高级摄影后期；宣传照片优先生成式辅助并进行原图比对，体态/前后对比与动作证据使用严格非生成式模式；支持单张批量、隐私高斯模糊、构图审核。
---

# 7Fit Photo Retouching · V1.2 (2026-10-12)

## Outcome and priority

**让真实的 7Fit 照片呈现明亮通透、人物立体、肤色自然柔和、环境干净、专业摄影构图的效果，但不夸张改变身材。**

Resolve conflicting requests in this order:
1. P0 **truth and safety**: maintain real member identity/anatomical proportions, exercise mechanics, clothing, equipment, logos, meaningful labels, privacy and consent. Never invent member progress.
2. P1 **aesthetic quality**: harmonious light hierarchy, white balance, skin color, clean background, natural dimensionality, restrained contrast, composition.
3. P2 **convenience**: batch processing, export variants, speed. A visually appealing output that fails P0 must be rejected.

Read `references/7fit-aesthetic-v1.2.md` before any creative edit; read `references/real-photo-review.md` and `references/implementation.md` for failure patterns, privacy and technical boundaries.

## Route the purpose, not just the visual contents

| Purpose (Chinese examples) | Default route | Generative editing? |
| --- | --- | --- |
| Social media course photography, training moment, gym space/marketing, lifestyle portrait (日常课照/场馆宣传/封面/朋友圈) | **EDITORIAL_ENHANCE** — generative-assisted when an *authorized* image editing tool and member-permitted workflow are available; otherwise advanced source-only grading | Only for presentation enhancement; use source-locked/local work where possible, compare to original |
| Routine records whose purpose is exact exercise documentation (专业训练记录/动作教学/关节角度分析) | **DOCUMENTARY_LOCKED** — genuine non-generative pixels/geometry | No |
| Body assessment, posture correction evidence, before/after comparisons, measurable training results (体态评估/成果对比/肩胛骨或骨盆位置) | **EVIDENCE_LOCKED** — matched neutral source photography, strict non-generative | Never |
| Explicit ad concept, stylization, nostalgic poster, background replacement (宣传创意图/复古海报/合成) | **CREATIVE_COMPOSITE** — separately labeled creative workflow | Yes if authorized; never market it as unaltered training evidence |

**The user-approved aesthetic preference defaults to EDITORIAL_ENHANCE for ordinary promotional course photos**, not to unbounded full-frame regeneration. A request to “保留原片/无 AI/真实记录” overrides editorial. If the purpose is ambiguous and the edit could affect clinical/posture evidence, use DOCUMENTARY_LOCKED. A scene may be gym imagery but still evidence: intent wins.

## Hard rules shared by all routes

- Use the exact uploaded original image as the primary visual reference. Preserve source files unchanged and record SHA-256 for deterministic workflows; do not silently replace a training moment with a new scene.
- Preserve face/identity when visible, actual body width and contours, shoulder blade/pelvis/limb alignment, clothing/texture, hand grips, bar paths, gear, brand text and plate numbers. For marketing, even a very pretty image is unacceptable if these drift. Avoid AI-generated muscles, skin smoothing that erases real texture, slimming, lengthening limbs and retouching posture.
- **Generative risk is unavoidable:** even with locking instructions, a full-frame AI result cannot guarantee exact person, gym text, objects, pose or pixels. Inspect against source at full size. If precision cannot be verified, fail and use non-generative editing or request a small localized patch; never claim pixel identity for generated regions.
- No member photo to an unapproved external service. Verify authorization and posting consent separately from visual privacy. Local privacy treatment remains the safe alternative.
- Visible frontal/profile/three-quarter/reflected faces: separately apply reviewed source-aligned Gaussian blur **after** any generative operations. Do not rely on a regenerated “already blurred” face. Rear-facing views should not be blurred unnecessarily. Facial blur is not a guarantee of anonymity; check tattoos, clothing, background and metadata.
- Publish **one file per original**. No automatic collage, no fabricated “before” or “after”. Cropping is permitted for marketing when verified to retain subject body, hands, feet, load, mat and key training context. EVIDENCE_LOCKED has no crop/perspective correction or body alterations.
- Room/sign/text cleanup must not manufacture a different studio or rewrite the actual 7Fit / 7FITNESS sign. Refrain from removing gear that materially explains the exercise or member's environment.

## Editorial retouch recipe (DEFAULT for 7Fit marketing)

1. **Analyze original:** light source, background, warm/cool cast, wall/window highlights, black-floor details, subject placement, face orientation, hand/foot boundaries and signage. Identify marketing vs evidence before applying tools.
2. **Composition:** remove superfluous blank wall or ceiling if this strengthens focus; keep limbs, load and training props fully readable. Favor 4:5 for social sharing, with a separate uncropped copy; never force a 4:5 crop that cuts action.
3. **Lighting:** open midtone shadows on subject; keep white curtains and windows with tonal detail; don't flatten dark floor or make black tights gray. Give subject/background a subtle light hierarchy—no theatrical rimlights or invented sunlight.
4. **Skin and texture:** neutral-to-gently-warm believable skin, skin pore texture intact, no over-whitening, no plastic blur, no fake abs or exaggerated deltoids. Keep fabric grain, hair and equipment sharp but natural.
5. **Color:** low-to-moderate saturation, clean off-white walls, neutral blacks, subtle tasteful warm/cool separation; the studio's real purple accent and logo must remain accurate.
6. **Generative assistance (if available, permitted):** targeted cleanup or lighting reinterpretation using the original photo as reference; explicitly lock person geometry, clothing, exercise, letters/logos, training equipment, perspective and hand/foot positions. Prefer small masked regions and original-pixel compositing when possible. Store method/provenance.
7. **Privacy LAST:** manually review every face, then use deterministic blur on the final output; a no-face classifier is insufficient. Review all individual exports.
8. **QC vs source:** full image and 100% crops. Reject hallucinated logo/weights, deformed anatomy, missing cables, changed skin/face, unnatural sharpened edges, cropped feet, orange skin, blown whites, flattened blacks or insufficient anonymization.
9. Export independently as requested (uncropped master plus optional 4:5 / 9:16). State which outputs used generative edits and which are source-only. Do not imply they are evidentiary originals.

## Documentary and evidence route (working V1.1 CLI)

The checked-in `scripts/retouch.py` is **a non-generative Pillow renderer**, with verified per-file face annotations and fail-closed batch behavior. It is **not** an ImageGen backend or an automated semantic subject editor. It can be used as the conservative source-only baseline, especially for DOCUMENTARY_LOCKED and EVIDENCE_LOCKED.

```bash
python scripts/retouch.py inspect /private/photos/member.jpg
python scripts/retouch.py batch --input /private/photos \
  --output /private/7fit-exports --mode course \
  --privacy blur --annotations /private/face-review.json \
  --strength 0.85 --exports original 4x5
python -m unittest discover -s tests -v
```

Per-file review example, for EXIF-orientation-normalized original coordinates:

```json
{
  "back.jpg": {"mode":"course","reviewed":true,"no_visible_face":true},
  "side.jpg": {"mode":"course","reviewed":true,"faces":[[0.41,0.13,0.59,0.31]]}
}
```

`--privacy blur` requires reviewed face regions or reviewed `no_visible_face:true` for every image. `--privacy keep` requires per-photo `consent_confirmed:true` and real operator confirmation. Detector output is merely a suggestion; output `manifest.json` sets `safe_to_publish:false`. `comparison` mode disables tone changes and cropping; it re-encodes a JPEG rather than preserving pixel bytes.

## Implementation transparency / release criteria

- **V1.2 currently establishes the aesthetic and engine-selection protocol in this Skill.** It does not claim to ship a generative API, a Photoshop adapter, or a working image-to-image backend inside `retouch.py`. The authorized host (e.g. a Codex runtime with native ImageGen) must actually provide and test such a capability.
- Never pretend that adding the word “generative” to a prompt means generated output passed source-based geometry checks. Visual QA and privacy clearance are manual.
- Earlier V1.1 synthetic unit tests exercise the local source-only engine, **not** the creative route. V1.2 editorial output requires manual before/after visual validation on consented photos and explicit provenance.
- If no authorized generative tool is available, deliver high-quality non-generative work and disclose the limitation; never upload member images or fake a completed edit.

See `references/implementation.md` for actual installed dependencies, local CLI limitations and photo-review structure.