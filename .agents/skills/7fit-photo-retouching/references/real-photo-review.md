# 7Fit V1 → V1.1 real-photo audit (October 2026)

## Evidence reviewed

Seven+ genuine 7Fit training scenes were provided in this conversation (seated rows, gym hip hinges, side raises, single-leg balance, lat-pull, elevated BOSU plank), followed by image-generation-based attractive outputs. The result was bright and usable for *creative marketing*, but not rigorously faithful enough for progress and session documentation.

## Observed / high-risk deficiencies

- **Engine mismatch:** V1 Skill calls for original-file processing, but the prior conversation routed the photos to whole-image generation. Generated texture and pixels differ throughout the scene. The actual Python V1 pipeline was not responsible for the displayed results.
- **Text and equipment continuity:** on-wall brand lettering, small labels/weights, mirrored edges, knee band texture, window bars, mats, cables and gym machines must remain exactly as photographed. Full-frame generative outputs can reconstruct or subtly change those details even when they look more premium.
- **Anatomical evidence:** subject contour, shoulder/hip alignment, head angle and load position must be preserved. Tone may be adjusted; shape cannot.
- **Blurring:** profile and three-quarter faces still need obscuring. A visually soft face is not a verifiable anonymization guarantee; faces seen from the rear typically need no artificial blur. A global `no faces found` detector result must not clear a batch.
- **Composition:** large empty wall/ceiling can be safely reduced only after examining hands, toe tips, floor contact, mat, equipment and movement. Some wide views explain exercise context; removing the full rack can reduce educational meaning.
- **High-key treatment:** white shirts and windows must not wash out; dark tights, black floors, dark equipment and hair retain definition. No uniform 1.08–1.09 brightness multiplication without highlight consideration.

## V1.1 policy decisions

P0: default non-generative; source SHA, protected geometry; independent per-file privacy; fail-closed batch; never publish automatically. 

P1: adaptive bounded luminance curve rather than unguarded brightness multiplication; restrained global color/sharpness; user-reviewed optional crop; internal export/frame QA.

P2 (future): color-managed RAW pipeline, properly masked local dodging/burning, gradient subject/background selection, reliable human-in-the-loop face segmentation, batch color reference matching, external image-generation opt-in as a separately labelled creative mode.

## Acceptance rubric (manual photographic QA)

Each output compared with original, in full-frame view and at 100% zoom:

1. **Identity geometry**: no new or missing limb/finger; same exact posture and shoulder/pelvis/leg contours; no pose reconstruction.
2. **Exercise fidelity**: grips, straps, cables, weights, mat edges, mirror reflections, rack components and all readable product/brand text match the original.
3. **Tone and material**: moderate brightening, wall/window and shirts not clipped, skin not orange/plastic, black garments not charcoal-gray.
4. **Privacy**: every visible frontal/profile face reviewed, mirrored faces too; blur continuous and adequate; consent and contextual identification handled independently.
5. **Composition**: no head/hand/foot/band/weights cropped, unless intentionally approved; visual focus clear and enough background to explain training.
6. **Deliverability**: source hash unchanged; each file independent; original-orientation correct; no EXIF/GPS leakage in JPEG; inspect saved file not just preview; `safe_to_publish` remains false until real review.

## Non-goals

Do not implement semantic object-removal via broad generative replacement or assume automated face detection alone is a privacy review. Do not claim verified real-world physique improvements from software-enhanced photos.