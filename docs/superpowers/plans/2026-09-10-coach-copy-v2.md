# Coach Copy V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `复制教练版` from a system-data dump into a standalone single-session execution card that a 7Fit coach can use without reopening the detail page.

**Architecture:** Keep `js/session-copy.js` as the presentation/semantic conversion layer and enrich copy payloads in `js/views-coach.js` only with stable action identity needed for deterministic coach semantics. Reuse the existing member semantic helpers where appropriate, but keep coach-specific goal, cue, observation, rest, and theme rules separate so the member copy does not regress.

**Tech Stack:** Dependency-free browser JavaScript, Node `vm` formatter tests, existing V14 anatomy/action data, GitHub Actions Python/Node/schema/Playwright gates.

**Spec:** Agreed Coach Copy V2 Phase 1 conversation design: course identity, session goal, grouped PREP, A/B/C/D information hierarchy, coach-purpose layer, session observations, recovery, and existing cardio. Excludes member binding, readiness/override, training-history persistence, and actual-performance database fields.

## Global Constraints

- Do not change `formatMember()` output semantics except shared helper refactors that preserve all member-copy tests.
- Do not introduce member binding, readiness, override, regression/progression trees, or persisted training history in this phase.
- Preserve the current 7Fit post-cardio recommendation: about 30 minutes; average heart rate 130–140 bpm around the recommended fat-burning heart-rate range.
- Preset sessions and Composer must use the same coach-copy rules.
- Do not expose equipment IDs, action IDs, schema/debug/provenance metadata, raw resolver state, or default no-conflict boilerplate in copied coach text.
- Keep coach-useful tier/grade labels (`T1–T4`, `SUP-S*`, `CORE-L*`) compactly available beside the action name.
- PREP stays 2F, strength 1F, recovery 2F; cardio remains post-session.

---

### Task 1: Lock Coach Copy V2 output contract with failing tests

**Files:**
- Create: `tests/session_copy_coach_v2_test.js`
- Modify later for compatibility: `tests/session_copy_test.js`, `tests/session_copy_v1462_test.js`, `tests/composer_copy_test.js`

**Interfaces:**
- Consumes: `window.V14SessionCopy.formatCoach(payload, options)`
- Produces: deterministic assertions for course identity, grouped PREP, goal, action hierarchy, cues, observations, recovery, cardio, and anti-leak rules.

- [ ] **Step 1: Write a failing formatter test**

Use a fixed `now` value and a representative L3 `下肢推 + 水平拉 + 支撑` payload containing A/B/C/D1/D2/CORE. Assert:

```js
const coach=api.formatCoach(payload,{now:'2026-09-10T12:00:00+08:00'});
assert(coach.includes('2026年9月10日｜星期四'));
assert(coach.includes('7Fit｜私教训练'));
assert(coach.includes('F111-01｜L3 负重进阶'));
assert(coach.includes('下肢推 × 水平拉 × 核心稳定'));
assert(coach.includes('动线：2F 准备 → 1F 力量 → 2F 恢复'));
assert(coach.includes('本节目标'));
assert(coach.includes('PREP｜约 10–12 分钟'));
assert(coach.includes('A｜哈克深蹲｜T3'));
assert(coach.includes('目标：大腿与臀部力量'));
assert(coach.includes('Cue：'));
assert(coach.includes('本节观察'));
assert(coach.includes('RECOVERY'));
assert(coach.includes('课后有氧｜约 30 分钟'));
assert(coach.includes('平均心率：130–140 bpm 左右（燃烧脂肪心率）'));
```

Also assert the coach copy does **not** contain `【本节主要训练肌群】`, `【系统提醒】`, `当前方案未发现替换后冲突`, equipment IDs, or raw `POST CARDIO ONLY`.

- [ ] **Step 2: Push the test-only commit and verify the branch CI fails for the new assertions**

Expected: existing formatter cannot satisfy the new identity/goal/PREP/observation/cardio contract.

---

### Task 2: Add deterministic coach semantic helpers

**Files:**
- Modify: `js/session-copy.js`
- Test: `tests/session_copy_coach_v2_test.js`

**Interfaces:**
- Consumes: payload `recipeId`, `recipeName`, `sessionTitle`, `level`, `foam`, `warmups`, `slots` and action/anatomy data.
- Produces: `coachTheme`, `coachReason`, `coachPrepGroups`, `coachPurpose`, `coachCue`, `coachObservation`, `coachRest`.

- [ ] **Step 1: Add coach theme normalization**

Normalize recipe names such as `下肢推 + 水平拉 + 支撑` to:

```text
下肢推 × 水平拉 × 核心稳定
```

- [ ] **Step 2: Add coach session-goal generation**

Generate one concise paragraph from Level + A/B actions + lower/upper patterns + D1/D2 purposes, e.g.:

```text
L3 负重进阶阶段。A 位用哈克深蹲建立下肢推主要负荷，B 位用坐姿划船建立水平拉主要负荷；C / CORE 负责核心稳定，D 位补充大腿前侧与肩后侧和上背训练量。
```

- [ ] **Step 3: Add coach-purpose rules**

Reuse anatomy-first purpose detection but retain coach vocabulary. D1/D2 must not inherit A/B main-pattern purpose when anatomy provides a more specific auxiliary purpose.

- [ ] **Step 4: Add main-action Cue rules**

Only A/B receive default copied cues. Rules are deterministic by action pattern/name. Examples:

```text
蹲：足底三点稳定，膝盖与脚尖方向一致
水平拉：先稳定肩胛，再向后拉肘
水平推：肩胛稳定，推起时保持手腕与前臂对齐
髋铰链：保持脊柱中立，髋向后移动
```

- [ ] **Step 5: Add observation rules**

Select A, B, and C (fallback CORE) as the default `本节观察` set. Keep Observation separate from Cue, e.g.:

```text
A 哈克深蹲：膝轨迹 / 骨盆稳定 / 左右发力
B 坐姿划船：肩胛控制 / 耸肩代偿 / 左右拉力
C 高位平板交替触肩：骨盆旋转 / 重心转移
```

- [ ] **Step 6: Add compact rest defaults**

If prescription text already includes rest, preserve it. Otherwise append only to main execution lines:

```text
A/B: 休息 90s
C/CORE: 休息 45–60s
D1/D2: no default rest line
```

These are display defaults for the execution card, not new prescription database fields.

---

### Task 3: Replace `formatCoach()` with the V2 execution-card layout

**Files:**
- Modify: `js/session-copy.js`
- Test: `tests/session_copy_coach_v2_test.js`

**Interfaces:**
- Consumes coach semantic helpers from Task 2.
- Produces `formatCoach(payload, options={})` text.

- [ ] **Step 1: Add date-aware course identity**

Output:

```text
YYYY年M月D日｜星期X
7Fit｜私教训练
F111-xx｜Lx 阶段名
专业训练主题
动线：2F 准备 → 1F 力量 → 2F 恢复
```

For Composer, keep the `自由组合` identity instead of inventing an F111 preset ID.

- [ ] **Step 2: Render `本节目标` and `本节重点`**

Use one goal paragraph plus a compact pattern summary.

- [ ] **Step 3: Render grouped PREP**

Use `PREP｜约 10–12 分钟` followed only by non-empty functional groups: `泡沫轴松解`, `髋部活动`, `上肢活动`, `动态活动`, `核心激活`.

- [ ] **Step 4: Render STRENGTH with slot-specific density**

A/B:

```text
A｜动作｜Tn
处方｜休息 90s
目标：...
Cue：...
```

C/CORE:

```text
C｜动作｜SUP-Sn
处方｜休息 45–60s
目标：...
```

D1/D2:

```text
D1｜动作｜Tn
处方
目标：...
```

- [ ] **Step 5: Render centralized observations**

Add `本节观察` with up to three high-value lines; never duplicate full anatomy lists.

- [ ] **Step 6: Render recovery and standardized coach cardio**

```text
RECOVERY
...

课后有氧｜约 30 分钟
跑步机爬坡 / 楼梯机 / 快走 / 其他有氧
平均心率：130–140 bpm 左右（燃烧脂肪心率）
```

- [ ] **Step 7: Remove execution-irrelevant dump sections**

Do not render the old full anatomy dump or default `系统提醒`. Do not render raw `postCardio` internal boundary text.

---

### Task 4: Enrich preset and Composer payloads with stable action identity

**Files:**
- Modify: `js/views-coach.js`
- Test: `tests/composer_copy_test.js`

**Interfaces:**
- Consumes current selected action IDs.
- Produces each slot as `{actionId, slot, name, tier, grade, prescription}` without exposing `actionId` in formatted text.

- [ ] **Step 1: Add `actionId` to preset copy slots**

- [ ] **Step 2: Add `actionId` to Composer copy slots**

- [ ] **Step 3: Keep existing PREP and recovery payload behavior compatible**

---

### Task 5: Update legacy copy regressions and verify member copy stays frozen

**Files:**
- Modify: `tests/session_copy_test.js`
- Modify: `tests/session_copy_v1462_test.js`
- Modify: `tests/composer_copy_test.js`
- Test: `tests/session_copy_member_v2_test.js`

**Interfaces:**
- Consumes final V2 formatter behavior.
- Produces regression coverage for preset and Composer paths.

- [ ] **Step 1: Replace old coach-output assertions**

Remove assertions that require `7Fit｜教练训练单`, the full anatomy dump, and default `系统提醒`; replace with V2 identity, goal, target, Cue, observation, and cardio assertions.

- [ ] **Step 2: Keep coach tier/grade/RIR checks**

Confirm `T*`, `SUP-S*`, `CORE-L*`, and RIR remain visible for coaches where present.

- [ ] **Step 3: Re-run all member-copy assertions unchanged**

Member copy must still hide coach tiers/grades/RIR/internal metadata and preserve the approved 30-minute / 130–140 text.

---

### Task 6: Full verification, review, merge, and deploy

**Files:** no product-code changes unless verification exposes a defect.

- [ ] **Step 1: Push final branch and require `V14.8 Schema Check` verify + browser-smoke success**

The workflow runs Python regression, build freshness, V14.8 schema validation, every Node `*_test.js`, JS syntax checks, and Playwright critical-path smoke.

- [ ] **Step 2: Create PR from `codex/coach-copy-v2` to `master`**

Summarize scope, non-goals, output example, and verification evidence.

- [ ] **Step 3: Independently inspect PR diff and changed filenames**

Confirm only planned formatter/payload/tests/docs files changed and no member-copy regression or unrelated data/domain changes were introduced.

- [ ] **Step 4: Merge only when the PR is clean and all required checks pass**

Use squash merge.

- [ ] **Step 5: Verify `Deploy 7Fit Training System` on merged master completes successfully**
