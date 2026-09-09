## V14.8｜领域数据源与生成 Runtime

- `data/src/*.json` 现为 `window.V14_DATA` 的维护 Source of Truth，按 actions / patterns / sessions / SUPPORT / CORE / PREP / Foam / Composer / Venue / system 领域拆分。
- `data/src/manifest.json` 显式约束 26 个 Runtime 顶层 key 的唯一 owner 与原始 `topLevelOrder`。
- `data/system-data.js` 仍保留为浏览器同步加载的正式 Runtime bundle，但它是 **GENERATED**，不得手工维护。
- 数据修改后运行 `python tools/build_system_data.py`；CI 使用 `python tools/build_system_data.py --check` 阻止 source / bundle 漂移。
- V14.8 Schema Gate 继续校验生成后的 `window.V14_DATA`，浏览器接口和训练语义不变。
- 维护说明见 `docs/V14.8-DATA-SOURCES.md`。

## V14.7｜F111 自由组合编课矩阵

**正式发布状态：FINAL**

- 保留原有 **8 个 7Fit 推荐预设 / 32 套 L1–L4 Session**，旧链接继续兼容。
- 新增 **5 个下肢编课子模式 × 4 个上肢主模式 = 20 种自由组合**。
- 第 04「单腿模式」正式升级为双分支：**单腿蹲 + 单腿拉**。
- 新增单腿拉 T1–T4：扶持单腿髋铰链 → 扶持哑铃单腿 RDL → 独立哑铃单腿 RDL → 高阶负重单腿 RDL。
- 新增 `V14Composer` 运行时 Resolver，不硬编码 80 套 Session。
- Session L1–L4 只决定候选窗口：主动作 T、SUPPORT S、CORE-L 保持独立等级。
- SUPPORT：L3 默认 S3、常规 S2–S4；CORE：先选 Core Demand，再按 Grade 过滤。
- D1 / D2 改为随 A / B 主项动态推荐，目标是补足而不是复制主项。
- 正式力量槽位允许 `1F_ONLY` 与 `FLEX_1F_2F`，因此 L1 徒手深蹲 / 臀桥可正常进入 Composer。
- 臀伸 L4 沿用 `臀推停顿主项`，在 Composer 中以 **T4 高阶处方层**表达：`3–4组 × 6–8次｜RIR 1–2`；底层动作节点仍保留 T3，不虚构新器械动作。
- 自由组合继续接入 Anatomy、PREP、Foam、Conflict、处方/RIR、复制教练版与会员版。
- Runtime Anatomy 随 4 个新单腿拉节点扩展到 **243 / 243**。
- 桌面端使用 5×4 组合矩阵；≤620px 手机端自动切换为“选下肢 → 选上肢”的顺序选择。
- Release Gate：**20×4 = 80/80 自由组合状态均生成完整 A/B/C/D1/D2/CORE 六槽**。

## V14.6.3｜十大动作模式整合版

- 对外训练体系升级为 **十大动作模式**：8 个主动作模式 + 支撑模式 + 核心模式。
- 01–08 继续使用 T1–T4；09 支撑模式继续使用 S1–S6；10 核心模式继续使用 L1–L4 + Core Demand。
- 底层 `eightPatterns` 保留，F111 / PREP / Foam / Anatomy / Conflict / Copy 逻辑不改。
- 十大动作模式总览支持一键“复制本模块”。

# 7Fit Training System V14.6

V14 is the information-architecture rebuild of the V13.2 static training system. It separates daily coach work from training knowledge, programming rules, the action library, and maintenance/audit material while preserving the same training data and conflict logic.

## V13.2 baseline

- 32 F111 sessions
- 8 recipe families
- 30 SUPPORT nodes
- 20 CORE nodes
- 168 rendered action-detail cards
- 192 swap controls
- 32 conflict panels
- Eight-pattern baseline: V1.1

## Scope

V14 remains a dependency-free static web application. No backend, login, cloud sync, member profile, or AI auto-programming is introduced in this rebuild.

## Open

- Modular app: open `index.html` from the extracted folder.
- Standalone preview: `../7fit-training-system-v14.7-preview.html` is provided beside the ZIP for quick inspection.

## Primary routes

- `#/coach`
- `#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3`
- `#/coach/f111-01/l1` … `#/coach/f111-08/l4`
- `#/system/patterns`
- `#/system/support`
- `#/system/core`
- `#/rules/venue`
- `#/rules/replacement`
- `#/rules/conflicts`
- `#/library`
- `#/maintenance`


## V14.1 Readability Upgrade

- Raised Chinese body copy from legacy 7–9px ranges to approximately 12–14px.
- Increased headings, labels, filters, buttons and action metadata proportionally.
- Increased line-height for long Chinese copy.
- Kept the V14 information architecture, training data, routes and conflict logic unchanged.

## V14.2 Official Brand Logo

- Replaced the temporary single-character `7` app mark with the official 7Fit logo asset.
- Preserved the original logo glyph artwork without redraw or font substitution.
- Added the same logo asset as the browser favicon.
- Training data, routes, layouts and conflict logic are unchanged.

## V14.3 PREP Warm-up System

- Added 20 canonical PREP warm-up nodes supplied from the 7Fit venue workflow.
- Added independent PREP grades P1–P4; warm-up grade does not overwrite the main movement T1–T4 ladder.
- Added matching dimensions: Session L1–L4, main training T1–T4, and eight main movement patterns.
- Added `#/system/prep` warm-up matcher.
- Coach-session PREP now shows warm-up recommendations matched to the current lower + upper main patterns.
- Current batch distribution: P1 = 9, P2 = 9, P3 = 2, P4 = 0.
- P4 is intentionally reserved for later explosive / high-coordination preparation; warm-up is not progressed merely to make it harder.


## V14.4 Foam-Roll Muscle Matching

- Added 12 canonical foam-roll matching nodes.
- Added 6 new source actions: shoulder, triceps, biceps, adductors, lateral thigh, and thoracolumbar paraspinal region.
- Standardized the existing chest action to `泡沫轴松解-胸大肌`.
- PREP matcher now renders `泡沫轴松解建议` before P1–P4 dynamic warm-up / activation.
- Each F111 session now renders `当前课程泡沫轴匹配` from the current lower + upper main patterns.
- Session recommendations choose up to 2 lower-body + 2 upper-body foam-roll options; coach should select only 2–4 actually tight regions, not roll everything.
- Foam rolling remains a PREP soft-tissue layer and does not alter T1–T4 or P1–P4.


## V14.5 Action Anatomy Layer

- Added an independent `window.V14_ANATOMY` layer instead of mutating T1–T4, SUPPORT, CORE, PREP, F111 or Venue Truth.
- Phase A curated 120 unique runtime anatomy nodes covering F111 / eight-pattern chains / SUPPORT / CORE / PREP / Foam Roll.
- Added action-detail anatomy, live F111 muscle summary, anatomy-aware PREP/Foam ranking and `MUSCLE_CONCENTRATION` soft WARN.

## V14.6 Full Runtime Anatomy Coverage

- Extended anatomy from 120/239 to **239/239 runtime actions**.
- Phase B: **85/85** remaining strength / activation / warm-up nodes.
- Phase C: **34/34** conditioning / recovery / stretch nodes.
- Added `roleType=conditioning`; conditioning remains visible in anatomy but is excluded from precise `MUSCLE_CONCENTRATION` exposure scores.
- `stretch`, `mobility` and `foam_roll` also remain outside strength exposure scoring.
- Runtime confidence totals: **HIGH 151 / MEDIUM 83 / REVIEW 5**.
- REVIEW nodes stay usable and visible but do not enter precise concentration WARN calculations.
- Maintenance now reports Runtime Anatomy 239/239 with Phase A/B/C coverage separately.

## V14.6.1｜一键复制训练单

- F111 课程详情新增「复制教练版」「复制会员版」。
- 复制内容读取当前实时选中的 6 个正式训练动作，替换动作后再次复制会同步更新。
- 教练版包含：课程/L 等级、泡沫轴、PREP、A/B/C/D1/D2/CORE、肌群摘要、恢复、有氧与系统提醒。
- 会员版隐藏 T 层级、器械元数据、内部 ID、冲突代码和系统审计，仅保留会员容易理解的训练安排。
- 优先使用 Clipboard API；不可用时自动回退到浏览器传统复制机制。

## V14.6.2｜通用模块复制系统

- 新增网站级 `复制本模块`：PREP、泡沫轴、动作详情、十大动作模式、SUPPORT、CORE、规则页等统一复用。
- F111 教练版复制简化为 `动作名｜T层级`，删除器械、楼层和内部系统字段。
- 教练版增加组数、次数/时间与 RIR；源数据只有 RPE 时显示近似 RIR。
- 会员版保留实际训练处方，但隐藏 T 层级、RIR 和系统技术字段。
- 验证详情见 `docs/V14.6.2-VALIDATION.md`。