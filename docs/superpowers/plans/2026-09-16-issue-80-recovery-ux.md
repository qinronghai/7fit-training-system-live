# Issue #80 — F111 Recovery UX

## Scope

Replace the fixed two-item F111 Recovery block with a deterministic, data-driven
three-region stretch recommendation derived from the resolved A/B/C/D1/D2/CORE
session. The change is limited to F111 preset and composer Recovery; Body,
Conditioning, HYROX, PREP, POST CARDIO, and save-state schemas remain unchanged.

## Contract

- Candidate actions must be explicit `RECOVERY_2F` catalog records with recovery
  metadata; no name substring matching and no fabricated action IDs.
- The matcher consumes the current `ResolvedSession.main.content`, so manual
  replacement and restored selections change Recovery recommendations.
- A successful result contains exactly three actions from distinct recovery
  regions, each with a 45-second prescription and a short reason.
- Selection is deterministic: explicit pattern/load-family matches, slot
  weighting, recovery priority, then action ID tie-break.
- If the catalog cannot provide three valid unique regions, return an explicit
  incomplete result and render a coach-visible fallback; never duplicate a card.
- Public UI copy must say `完成拉伸｜约 5–8 分钟`, show three readable cards,
  expose `查看动作详情` deep links, and never expose venue routing text.
- Desktop uses three columns; mobile uses one column with no horizontal
  overflow. Copy payloads use the same resolved recommendations as the UI.

## Test and review gates

1. Red/green runtime tests for dynamic selection, uniqueness, determinism,
   malformed input, incomplete fallback, and venue-copy hygiene.
2. Browser tests for preset and composer at 390, 1080, 1280, and 1440px;
   assert cards, links, responsive layout, no overflow, and no page/console
   errors. Follow a detail link into the Library drawer.
3. Existing F111 copy/runtime tests, all Node runtime tests, Python/schema/build
   checks, artifact hygiene, JS syntax, and `git diff --check`.
4. Local browser/computer-use visual and accessibility inspection with captured
   evidence after automated tests pass.
5. Code review on the feature branch, then a stacked PR against the Issue #79
   branch. Leave Issue #80 and all parent issues open pending explicit merge and
   close authorization.
