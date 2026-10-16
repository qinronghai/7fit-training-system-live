# 7Fit 编课系统｜完整体检报告

- 日期：2026-09-17
- 基线：`master` @ `61beb976`
- 门禁状态：Python 219 passed / Node 56 passed / 数据生成一致性 PASS / V14.8 Schema PASS / 浏览器 Smoke CI 40 passed
- 线上 Pages：build `61beb976`，与 `master` 一致
- 审计方式：静态代码走查 + 数据层量化 + Playwright 真实渲染实测（390px / 1440px，24 张截图）

---

## A. 层级不统一（对应反馈 1b）

从「编课中心」到一节课的点击深度：

| 模板 | 路径 | 点击 |
|---|---|---|
| F111 女性综合 1+1+1 | `#/coach` → `#/coach/f111`（8 预设 × L1–L4 全在一页 + 自由组合编课入口）→ session | **2** |
| 体能训练 | `#/coach` → `#/coach/conditioning`（4 family × L1–L4 全在一页 + 自由编课）→ session | **2** |
| HYROX | `#/coach` → `#/coach/hyrox`（4 类型 × L1–L4 全在一页）→ session | **2** |
| **健美式塑形** | `#/coach` → `#/coach/body`（6 张训练模式卡 + 4 张 Family 卡 + 长篇原则说明）→ `#/coach/body/body-01`（只有 L1–L4）→ session | **3** |

结论：**Body 是唯一有"中间层"的模板**，而且它的首页额外承载了 6 张训练模式科普卡，把真正的决策推迟到第二层。F111 / Conditioning / HYROX 都是"首页即矩阵"。

附带不一致：`data/src/templates.json` 中 `body.capabilities` 声明 `composer:false`、`copy:false`，但实际：

- `#/coach/body/compose?family=BODY-01&level=L1` 路由可用、页面正常渲染；
- Body 首页有「进入 Body 自由编课 →」CTA；
- Body 会话页有「复制教练版 / 复制会员版」按钮。

**capabilities 声明与实际能力不符**（`composer`、`copy` 两项）。

---

## B. UI 不统一（对应反馈 1a）

同一件事（五个热身槽位 + 可替换）在四个模板里有 **5 套实现**：

| 模板 | 分区标题 | 卡片类名 | 替换控件类名 |
|---|---|---|---|
| F111 预设 | `2F｜PREP` | `.session-warmup-card.prep-slot-card` | `.prep-slot-select` |
| F111 自由组合 | `2F｜PREP` | 同上 | 同上 |
| 健美式塑形 | `PREP｜动态热身 / 激活` | `.body-prep-card` | `.body-prep-select` |
| 体能训练 | `PREP / PRIMER｜动态热身 · 动作排演` | `[data-conditioning-prep-slot-card]` | `.conditioning-prep-select` |
| HYROX | `PREP｜动态热身 · Station 准备` | `[data-hyrox-prep-slot-card]` | `.hyrox-prep-select` |

其他结构差异：

- **复制入口位置不统一**：F111 在会话工具栏；HYROX 单独开一个 `课程复制` 分区；Body / Conditioning 在工具栏。
- **页面副标题 bug**：`js/app.js` 的 `labels()` 只处理了 `template`、`template-compose` 和 `recipeId`，没有处理 `template-family` 与 `template-session`。实测 4 个路由显示默认值 `Multi-Template Coach Center`：
  - `#/coach/body/body-01`
  - `#/coach/body/body-01/l3`
  - `#/coach/conditioning/con-01/l3`
  - `#/coach/hyrox/skill/l3`
- **Body 会话页渲染出 2 个空 `<h2>`**（可见、无文字），属 DOM 卫生问题。

---

## C. 泡沫轴模块缺失（对应反馈 2a）

`js/coach/foam.js`（`M.Foam`）**只被 F111 使用**：

- 使用方：`js/coach/session.js`（F111 预设）、`js/coach/prep.js`（F111 自由组合/共享 PREP）、`js/coach/composer-view.js`（复制载荷）
- 未使用方：`js/coach/body-prep.js`、`js/coach/conditioning-prep.js`、`js/coach/hyrox-prep.js` —— 三者都只渲染动态热身槽位

实测（会话页是否存在独立的泡沫轴区块）：

| 模板 | 独立泡沫轴区块 |
|---|---|
| F111 预设 / 自由组合 | ✅ |
| 健美式塑形 | ❌ |
| 体能训练 | ❌（正文出现"泡沫轴"是 PREP 动作名「泡沫轴仰卧肩屈上举」，不是松解模块） |
| HYROX | ❌ |

---

## D. 健美式塑形内容不足（对应反馈 2b）

实测 4 Family × L1–L4：

- 每状态 5–6 个正式槽位，每槽 4–7 个可替换候选。
- **L3 与 L4 的动作选择逐字相同**（4 个 Family 全部如此）。等级只改变了组数/RIR，没有改变动作。

```
BODY-01 臀腿｜股四主导
  L3 = 半蹲哈克 | 徒手分腿蹲 | 坐姿髋外展 | 坐姿腿弯举 | 臀部后踢腿 | 绳索站姿髋内收
  L4 = 半蹲哈克 | 徒手分腿蹲 | 坐姿髋外展 | 坐姿腿弯举 | 臀部后踢腿 | 绳索站姿髋内收   ← 完全相同
```

- BODY-01 在 L2 / L3 / L4 都含「半蹲哈克」——即 issue #93 描述的"重复半蹲 / 哈克问题"。
- 修复工作已存在于 `feature/issue-93-body-level-pools`（PR #111，+2273/−57，CI 绿，未合并）。

---

## E. 热身单一（对应反馈 3a）——根因已定位

全量解析 152 个状态（F111 预设 ×32、自由组合 ×80、Body ×16、Conditioning ×16、HYROX ×8）。

### 现象

| 等级 | F111 8 个预设产出的不同热身清单数 |
|---|---|
| L1 | 5 |
| L2 | 4 |
| **L3** | **2** |
| L4 | 3 |

L3 的 8 个预设主项分别是 高脚杯深蹲 / 罗马尼亚硬拉 / 臀推机 / 分腿蹲 × 飞机拉背 / 高位下拉 / 器械胸推 / 器械推肩 —— **完全不同的训练内容，却只产出 2 种热身清单**。

各槽位的候选池在不同预设之间也几乎相同（同一等级下 4/5 个槽位的候选集完全一致，只有默认选中项顺序不同），`why` 说明文字同样不随主项变化。

### 根因（`js/prep-resolver.js`）

1. **排序主键错位**：
   ```js
   items.sort((a,b)=>a.gradeRank-b.gradeRank || b.slotScore-a.slotScore || a.curatedPriority-b.curatedPriority || a.prepId.localeCompare(b.prepId));
   ```
   `gradeRank`（等级接近度）压制了 `curatedPriority`（动作模式匹配）——主项匹配只是第三顺位。

2. **模式匹配信号饱和**：`slotScore` 中的 `patternOverlap` 统计 `targetPatterns` 命中数。而 **52 个 PREP 节点里有 21 个声明了全部 8 个动作模式**（`targetPatterns.length === 8`）。对这些候选，`patternOverlap` 恒等于 2，**没有区分度**，排序退化到按 `prepId` 字母序。

3. **人工匹配表同样没有筛选力**：`warmupMatchByPattern` 每个模式列出 32–40 个节点（占全库 62–77%）。

4. **等级窗口没打散**：每个等级 5 个槽位落在同一个 P 级（L1 全 P1、L3 全 P3），缺少 RAMP 那种"低→高递进"的编排。

| 模板 | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| F111 | P1,P1,P1,P1,P1 | P2×5 | P3×5 | P4,P3,P3,P4,P4 |
| Body | P1×5 | P2×5 | P3×5 | P4,P3,P4,P4,P4 |

---

## F. 关节灵活度强调不足（对应反馈 3b）

52 个 PREP 节点的 `regions` 词频：

```
核心 29 | 骨盆 24 | 肩胛 16 | 髋 15 | 胸椎 10 | 肩关节 9
踝 6 | 臀部 4 | 膝 3 | 足踝 2 | 小腿 1 | 足部 1
```

躯干与髋占绝对多数；**踝 + 足踝 + 足 + 膝 + 小腿合计仅 13 次**。而 7Fit 场馆女性会员最常见的限制恰恰是踝背屈与髋内旋。

---

## G. 课后有氧不可选（对应反馈 3c）——数据已就绪，只差 UI

数据层**已经有**需要的两个器械动作：

```
venue_treadmill_zone2   跑步机课后自主有氧   器械=跑步机   route=POST_CARDIO_ONLY
venue_stair_zone2       楼梯机课后自主有氧   器械=楼梯机   route=POST_CARDIO_ONLY
```

但：

- **没有任何运行时 JS 使用 `POST_CARDIO_ONLY`**——只有 `tools/validate_v148_schema.py` 与若干测试用它做"排除"校验。
- 页面上的课后有氧是一段写死文本（来自 `sessions.json` 的 `postCardio` 字段）。
- 复制文案同样是硬编码，且**两处格式不一致**：
  - `js/session-copy.js:26` → `选择跑步机爬坡、爬楼梯机、快走或其他有氧，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。`
  - `js/coach-copy.js:5-7` → `课后有氧｜约 30 分钟` / `跑步机爬坡 / 楼梯机 / 快走 / 其他有氧` / `平均心率：130–140 bpm 左右`

结论：要落地"选器械 + 时长 + 平均心率 + 可复制"，**数据层几乎不用新增**，缺的是 State 槽位 + UI 选择器 + 复制集成。

---

## H. 课后拉伸不一致（对应反馈 3d）——最关键的一条

| 模板 | 实现方式 | 实际内容 |
|---|---|---|
| F111 预设 / 自由组合 | 静态 `sessionViews[...].recovery` | **只有 2 个**拉伸动作，L1–L4 完全相同 |
| 健美式塑形 | `js/coach/body-recovery.js` | 一句文字：「如需拉伸，按当日训练肌群由教练人工选择」 |
| 体能训练 | `js/coach/conditioning-recovery.js` | 一句文字 + NO POST CARDIO |
| HYROX | `js/coach/hyrox-recovery.js` | 5 条文字要点，不是动作卡 |

F111 实测（8 个预设 × L3）：

```
f111-01  臀肌拉伸 | 背阔肌拉伸
f111-02  臀肌拉伸 | 背阔肌拉伸
f111-03  腘绳肌拉伸 | 背阔肌拉伸
f111-04  臀肌拉伸 | 背阔肌拉伸
f111-05  臀肌拉伸 | 背阔肌拉伸
f111-06  臀肌拉伸 | 胸肌拉伸
f111-07  腘绳肌拉伸 | 胸肌拉伸
f111-08  臀肌拉伸 | 背阔肌拉伸
→ 8 个预设去重后只用到 4 个动作：臀肌 / 腘绳肌 / 背阔肌 / 胸肌
```

匹配逻辑本身是对的（下肢主项决定臀肌 vs 腘绳肌，上肢主项决定背阔肌 vs 胸肌），**问题在于动作池太小，每节只给 2 个**。

### 数据里已有的、完全没被使用的资源

`route = RECOVERY_2F` 的恢复动作共 **14 个**：

- 自主拉伸 5 个：胸肌 / 臀肌 / 腘绳肌 / 髋屈肌 / 背阔肌
- **教练被动拉伸 9 个**：胸肌 / 背阔肌 / 肩后侧 / 肱三头肌 / 臀肌 / 腘绳肌 / 髋屈肌 / 大腿内侧 / 小腿后侧

`passive_*` 这 9 个动作（正是"由教练来带"的拉伸）**在整个运行时从未被引用**——只出现在 `data/src/actions.json` 与 `tools/build_anatomy_phase_c.py`。`RECOVERY_2F` 这个 route 在 `js/` 与 `tools/` 中同样没有任何代码使用。

> **结论：恢复/拉伸层根本没有 Resolver，只有写死的静态文本。**
> 你要的"3 个动作、教练带、匹配主动作与辅助部位"目前**只有素材，没有引擎**。

---

## I. 附带发现：Conditioning / HYROX 的 PRIMER 槽永远为空

`js/prep-resolver.js` 的 `normalizeContext` 会从 `data.actions[mainActionIds].pattern` 推断 `mainPatterns`。实测推断结果是：

- Conditioning → `["间歇"]`（协议名）
- HYROX → `["ENGINE","LOCOMOTION","BALL"]`（能力组 / 器械名）

**都不是动作模式。** 导致 `PRIMER`（主动作模式准备）槽：

```
conditioning  PRIMER  actionId=""  fallbackReason="no-eligible-candidate"  候选=0
hyrox         PRIMER  actionId=""  fallbackReason="no-eligible-candidate"  候选=0
```

**所有等级 L1–L4 都是空的**，CI 测试只覆盖了 Conditioning L1 的"空 Primer 要有解释"（issue #72 / `issue71_live_audit_browser.spec.js`），没有覆盖 L2–L4 与 HYROX。

---

## 建议修复优先级

### P0（直接命中三条核心抱怨）

1. **恢复/拉伸层建 Resolver**
   把 14 个 `RECOVERY_2F` 动作（含 9 个教练被动拉伸）接入运行时；Body / Conditioning / HYROX 用与 F111 相同的动作级恢复卡；每节 3 个动作，按主项 + 辅助部位匹配。

2. **课后有氧选择器**
   新增 POST CARDIO 槽位（器械 跑步机 / 楼梯机 + 时长 + 平均心率）+ 复制集成；消除 `session-copy.js` 与 `coach-copy.js` 两处硬编码文案的不一致。

3. **热身个性化**
   修 `prep-resolver.js` 排序权重与 `targetPatterns` 饱和；把 5 个槽位的等级窗口打散成低→高递进；目标：8 个预设产出 8 种不同热身。

### P1

4. 泡沫轴模块统一到全部模板（复用 `M.Foam`）。
5. Body 层级压缩到 2 步；`capabilities` 与实际能力对齐。
6. Body L3/L4 动作池分化（合并 PR #111 / issue #93）。
7. 统一 5 套 PREP 类名与分区标题；修副标题 fallback；清掉 2 个空 `<h2>`。

### P2

8. 补齐踝 / 足 / 膝活动度 PREP 节点。
9. 修 Conditioning / HYROX 的 `mainPatterns` 输入错误，让 PRIMER 槽可用。
10. 分支收敛：14 个 PR 的合并拓扑、3 个冲突 PR（#58 / #63 / #103）、38 个 squash-merged 残枝清理。

---

## 附：证据与复现

| 产物 | 路径 |
|---|---|
| PREP 多样性审计脚本 | `/tmp/7fit_prep_audit.js` |
| PREP 矩阵明细脚本 | `/tmp/7fit_prep_matrix.js` |
| UI 走查脚本（含截图） | `/tmp/7fit_ui_audit.js` |
| 截图 24 张（12 路由 × 390/1440px） | `docs/audit-assets/*.jpg` |
| UI 走查原始 JSON | `/tmp/7fit_ui_audit.json` |

本地环境（未纳入版本控制，已写入 `.git/info/exclude`）：`.venv/`（Python 3.13 + pytest/bs4/jsonschema）、`node_modules/`（@playwright/test 1.63.0）、`_site/`（静态预览产物）。

---

# 更正与补充：分支实现核查（2026-09-17 第二轮）

> 第一轮报告**只审计了 `master`**，没有进入任何分支的代码，因此对"恢复/拉伸层"和"健美式塑形动作池"两项给出了过时结论。本节为核查后的更正。

## 核查方法

对 14 个 open PR 分支逐个提取改动文件清单，再对命中痛点清单的三条分支链建立 git worktree，跑全部门禁并起独立预览（端口 4181/4182/4183）真实截图比对。

| worktree | 分支 | 实际包含 | 本地门禁 |
|---|---|---|---|
| `/tmp/7fit-wt/recovery-118` | `feature/issue-80-recovery-ux` | **#115 + #117 + #118** | 222 pytest / 58 node / build PASS / schema PASS |
| `/tmp/7fit-wt/body-114` | `feature/issue-95-equipment-station-diversity` | **#111 + #112 + #114** | 236 pytest / 60 node / build PASS / schema PASS |
| `/tmp/7fit-wt/cond-113` | `feature/issue-85-conditioning-blueprint` | **#113** | 221 pytest / 61 node / build PASS / schema PASS |

## 更正 1：课后拉伸 —— **#118 已经实现**（第一轮结论错误）

第一轮写"恢复/拉伸层根本没有 Resolver，只有写死的静态文本"。**这句话只对 `master` 成立。**

`feature/issue-80-recovery-ux`（PR #118）新增 `js/recovery-matcher.js`（97 行，`window.V14RecoveryMatcher`）：

- 把 `RECOVERY_2F` 的 **14 个动作全部**补齐 `recoveryRegion / recoveryRegionLabel / recoveryRegionGroup / recoveryTargetPatterns / recoveryTargetLoadFamilies / recoveryPrescription` 元数据（含 **9 个教练被动拉伸**）
- 按本节动作的 `pattern` 与 `loadFamily` 打分，槽位权重 `A/B=5, D1/D2=3, C=2, CORE=2`
- 按 `recoveryRegion` 去重，选 **1 个上肢 + 2 个下肢 = 3 个主要部位**
- 产出每张卡带「主要部位 / 动作 / 45 秒 / 匹配理由 / 查看动作详情」
- 池子不足 3 个时回退为教练人工安排的显式提示

实测截图对照（`docs/audit-assets-branches/B118-*.jpg`）：

| 状态 | master | #118 分支 |
|---|---|---|
| 区块标题 | `2F｜RECOVERY` | `完成拉伸｜约 5–8 分钟` |
| 动作数 | 2 个（写死） | 3 个（动态匹配） |
| F111-01 L3（蹲+水平拉） | 臀肌拉伸 / 背阔肌拉伸 | 上背与腋下·背阔肌 / 臀部·臀肌 / **髋前侧·髋屈肌** |
| F111-03 L3（髋铰链+水平拉） | 腘绳肌 / 背阔肌 | 上背与腋下·背阔肌 / 臀部·臀肌 / **大腿后侧·腘绳肌** |
| 自由组合（单腿拉+水平推） | — | **胸前侧·胸肌** / 臀部·臀肌 / 大腿后侧·腘绳肌 |
| 匹配理由 | 无 | 「匹配本节的上肢拉负荷」「匹配本节的后链 / 髋主导负荷」 |

动作池从 **4 → 14**，部位覆盖从 2 类 → **9 类**（胸前侧 / 上背与腋下 / 肩后侧 / 上臂后侧 / 臀部 / 大腿后侧 / 髋前侧 / 大腿内侧 / 小腿后侧）。

### 但 #118 **只覆盖 F111**

文件级核对：`js/coach/body-recovery.js`、`conditioning-recovery.js`、`hyrox-recovery.js` 在 #118 中**均未改动**。分支预览实测：

- Body → 仍是「如需拉伸，按当日训练肌群由教练人工选择」，**0 张恢复卡**
- Conditioning → 仍是纯文字 + NO POST CARDIO，**0 张恢复卡**
- HYROX → 仍是 5 条文字要点，**0 张恢复卡**

### 关键机会：Body 接进去几乎零成本

`V14RecoveryMatcher.match()` 只依赖 `resolvedSession.main.kind` 与 `main.content`。实测四个模板：

```
f111          main.kind=SLOT     -> status=complete   3 个部位
body          main.kind=SLOT     -> status=complete   3 个部位   ← 已经能跑！
conditioning  main.kind=PROTOCOL -> status=incomplete
hyrox         main.kind=PROTOCOL -> status=incomplete
```

也就是说 **Body 只要在 `body-recovery.js` 里调用 matcher 就能得到和 F111 一样的 3 部位拉伸**；Conditioning / HYROX 需要一个 PROTOCOL → action 的适配器。

## 更正 2：健美式塑形动作不足 —— **#111 + #112 + #114 已经实现**

第一轮只指出"L3 与 L4 逐字相同"，没有发现修复已经在分支里。

实测对照（4 个 Family × L1–L4，master vs `#114` 链）：

| Family | master L3 | master L4 | 分支 L3 | 分支 L4 |
|---|---|---|---|---|
| BODY-01 | 半蹲哈克 / 徒手分腿蹲 | **同 L3** | 哈克深蹲 / 哑铃反向箭步蹲 | 哈克深蹲 / **保加利亚分腿蹲** |
| BODY-02 | 杠铃硬拉 / 扶持哑铃单腿 RDL | **同 L3** | 哑铃罗马尼亚硬拉 / 独立哑铃单腿 RDL | **杠铃硬拉 / 高阶负重单腿 RDL** |
| BODY-03 | 低位划船 / 辅助宽握引体 | **同 L3** | 坐姿划船（变式）/ 辅助引体向上 | **自重引体向上 / 杠铃划船** |
| BODY-04 | 上斜俯卧撑 / 器械推肩 | **同 L3** | 哑铃卧推 / 半跪姿地雷杆推举 | 器械胸推 / 半跪姿地雷杆推举 |

master：**4/4 个 Family 的 L3 与 L4 完全重复**。分支：**4/4 全部形成 L1→L4 真实进阶链**（issue #93 的目标）。

插槽候选池同步变宽，例：`BODY-02 L3` 从 `7,4,4,4,4,4` → `8,8,6,2,2,2`。

残留可挑之处：`BODY-01 L4` 主项仍复用 L3 的「哈克深蹲」（靠第二槽区分）；`BODY-04 L4` 主项「器械胸推」与 L2 重复。

## 更正 3：Conditioning 单 Block —— **#113 已经实现**

`feature/issue-85-conditioning-blueprint`（44 文件 / +9875）建立 **4 Family × L1–L4 × A/B/C = 48 个确定性蓝图**，含 PREP、BUILD / MAIN / CHALLENGE、RECOVERY、教练提示、降阶、停止与完成标准；Resolver/Conflict 升级到多区块命名空间；保存使用独立 BLUEPRINT 状态键。实测 `con-01/l3` 的 Station 选择器从 **2 个 → 3 个**（多区块）。

## 经核查**确实没有任何分支处理**的项

对全部 14 个 open PR 分支做文件级 diff 核对，结果：

| 你反馈的问题 | 分支状态 | 核查依据 |
|---|---|---|
| 1a UI 不统一（5 套 PREP 实现） | ❌ **无分支处理** | master 与三条分支链的 PREP 标题/类名**逐字相同**（见下表） |
| 1b 层级不统一（Body 3 层） | ❌ **无分支处理** | 无分支改动 `body-home.js` 的 Family 中间层 |
| 2a 健美式塑形缺泡沫轴 | ❌ **无分支处理** | **无任何分支改动** `js/coach/foam.js` / `body-prep.js` / `conditioning-prep.js` / `hyrox-prep.js`；四条预览实测 `泡沫轴=false` |
| 3a 热身推荐单一 | ❌ **无分支处理** | **无任何分支改动** `js/prep-resolver.js`；根因（`gradeRank` 压制主项匹配 + `targetPatterns` 饱和 + `warmupMatchByPattern` 无筛选力）原样保留 |
| 3b 关节灵活度强调不足 | ❌ **无分支处理** | 无分支扩充 PREP 的踝/足/膝节点 |
| 3c 课后有氧不可选 | ❌ **无分支处理** | 无任何分支新增 POST CARDIO 选择器；四条预览实测 `课后有氧选择器=false`；`POST_CARDIO_ONLY` 的两个器械动作至今无运行时消费方 |
| 副标题 fallback bug | ❌ **无分支处理** | 四条预览的 `#/coach/body/body-01`、`body-01/l3`、`con-01/l3`、`skill/l3` 全部仍显示 `Multi-Template Coach Center` |

PREP 实现四分五裂的实测证据（四个版本完全一致，说明无人动过）：

```
                 PREP 标题                              select 类名                 泡沫轴
master           f111: 2F｜PREP                          prep-slot-select            true
                 Body: PREP｜动态热身 / 激活              body-prep-select            false
                 Conditioning: PREP / PRIMER｜…          conditioning-prep-select    false
                 HYROX: PREP｜动态热身 · Station 准备      hyrox-prep-select           false
#118链           完全相同
#114链           完全相同
#113             完全相同
```

## 修正后的行动顺序

**第 0 步｜先合并（否则在重复劳动）**

1. 合 **#115 → #117 → #118**（恢复/拉伸已做好，只等合并）
2. 合 **#111 → #112 → #114**（Body 进阶链已做好）
3. 合 **#113**（Conditioning 蓝图已做好）

**第 1 步｜在已合并的基础上做真正的缺口**（这些才是没人碰过的）

4. 把 `V14RecoveryMatcher` 接到 Body（近乎零成本），并为 Conditioning / HYROX 写 PROTOCOL 适配器 —— 达成你要的"所有模板拉伸都和 1+1+1 一致"
5. 泡沫轴模块复用 `M.Foam` 接入 Body / Conditioning / HYROX
6. 课后有氧选择器（器械 / 时长 / 平均心率 / 可复制），数据层已有 `venue_treadmill_zone2` 与 `venue_stair_zone2`
7. 热身个性化：修 `prep-resolver.js` 的排序权重与 `targetPatterns` 饱和
8. 统一 5 套 PREP 类名与分区标题；修副标题 fallback；Body 层级压到 2 步；补踝/足/膝活动度节点

---

# 第二轮独立复现与合并拓扑验证（2026-09-17）

> 本节不复述描述，只记录**本轮实际跑出来的证据**。凡与上文（含「更正与补充」）数字不一致处，以本节为准。

## 复现方法

| 项 | 做法 |
|---|---|
| 基线 | `master` @ `61beb976`（未改动的干净工作区） |
| 拓扑验证 | `.git` 内建 worktree，从 `origin/master` 逐个 `git merge --no-ff` 回放；冲突则记录文件并 `--abort`，不落盘 |
| 运行时复现 | Node + `vm` 加载 `data/system-data.js` → `js/resolvers/*` → `js/recovery-matcher.js`，按各模板真实 resolve 入参调用 |
| 门禁 | `pytest -q` / `tools/build_system_data.py --check` / `tools/validate_v148_schema.py` / `for f in tests/*_test.js; node $f` / `node --check` / `prepare_static_site.py` |
| 预览 | 4 个独立静态站 + `http.server`：master 4191、#118链 4192、#114链 4193、#113 4194 |
| 截图 | Playwright 1.63.0，390px / 1440px，12 条路由 × 4 预览，逐页 fullPage JPEG |

## 一、合并拓扑验证结论（第 0 步的答案）

### 1. 链内顺序依赖全部成立

```
git merge-base --is-ancestor 逐条验证：
  115(33e0dcc) → 117(abe1a21) → 118(a999758)      TRUE   ← 线性堆叠，必须按序合
  111(e4c08d1) → 112(8974259) → 114(05bddf4)      TRUE   ← 线性堆叠，必须按序合
  113(f362701)                                    直接基于 master（不是堆叠）
```

三条链各自 `merge` 到 `master` 都**干净通过**，链内没有冲突。

### 2. 更正：#113 并不「独立」

上文写「#113 独立」。实测**不成立**——#113 与两条链**都冲突**：

| 合并方向 | 结果 | 冲突文件 |
|---|---|---|
| A 链 → B 链 | ✅ 干净 | — |
| **B 链 → A 链** | ❌ 5 个文件 | `playwright.config.js` `data/change-log.js` `data/src/actions.json` `data/system-data.js` `schemas/v14.8/action.schema.json` |
| A 链 → C(#113) | ✅ 干净 | — |
| **C(#113) → A 链** | ❌ 4 个文件 | `assets/app.css` `data/system-data.js` `js/views-coach.js` `playwright.config.js` |
| B 链 → C(#113) | ✅ 干净 | — |
| **C(#113) → B 链** | ❌ 3 个文件 | `data/system-data.js` `js/state.js` `playwright.config.js` |

三条链的文件集合本来就重叠（A∩B 7 个、A∩C 5 个、B∩C 7 个），所以「互不干扰」这个前提是错的。

### 3. 冲突根因分三类（决定了怎么解，不是随机脏冲突）

| 根因 | 文件 | 解法 |
|---|---|---|
| **测试清单一行数组** | `playwright.config.js` | 14 个分支里有 **12 个互不相同的 `testMatch`**——每个 PR 都往同一行追加自己的 spec 文件名。属结构性缺陷，不是内容冲突 |
| **生成物整行** | `data/system-data.js` | 由 `tools/build_system_data.py` 从 `data/src/*.json` 生成，`warmupDetails` 全在一个物理行上；两边改同一行的不同区域必然冲突。**正解：先合源 JSON，再重新生成** |
| **真语义分歧（1 处）** | `js/views-coach.js` | A 链（#115）与 #113 **各自独立实现了同一功能**：PREP 下拉键盘导航。A 是 `bindPrepSelect`，C 是 `bindPrepKeyboard`。这是重复劳动，必须人工择一 |

其余（`js/state.js` 各插一个常量、`assets/app.css` 各追加规则、`data/change-log.js` 各插一条日志）都是**加法冲突**，保留双方即可。

### 4. 推荐的合并顺序（已实测）

```
C(#113) → A(#115→#117→#118) → B(#111→#112→#114) → E(#120) → D(#119) → F(#121)
```

- 冲突文件 **11 → 7 处**，优于 `A,B,C`（14）与 `B,C,A`（14）。
- 硬约束：**A 必须早于 B**（B→A 会多出 5 处冲突）；**C 必须早于 A 与 B**。
- D/E/F（#119/#120/#121）插在哪都不改变冲突数。
- 机读矩阵见 `docs/audit-assets-branches/R2-topology-matrix.json`。

## 二、门禁实测（本轮重跑）

| 目标 | HEAD | pytest | node | build --check | schema | 静态站 |
|---|---|---|---|---|---|---|
| `master` | `61beb976` | **219** | — | — | — | — |
| #118 链 | `a999758` | **222** | **58** | PASS | PASS | PASS |
| #114 链 | `05bddf4` | **236** | **60** | PASS | PASS | PASS |
| #113 | `f362701` | **221** | **61** | PASS | PASS | PASS |

与上文记录一致（`master` 基线 219 为第一轮数字）。四套 `node --check` 全过。

## 三、第一轮/第二轮描述的逐条复现结果

### ✅ 已证实

| 断言 | 复现方式与结果 |
|---|---|
| #118 新增 `js/recovery-matcher.js` **97 行** | `git show` = 97 行，一致 |
| 14 个 `RECOVERY_2F` 动作、9 个 `passive_*`、全部补齐元数据 | JSON 统计：total=14，passive_*=9，`recoveryRegion`=14，`recoveryRegionGroup`=14 |
| #118 **一行没改** 三个 recovery 文件 | `git diff 117..118` 对 `body-recovery.js` / `conditioning-recovery.js` / `hyrox-recovery.js` 均为 **0 行** |
| Body 接 matcher 几乎白捡 | 分支上实测 `f111 main.kind=SLOT → complete [上背与腋下/臀部/髋前侧]`、`body-01 main.kind=SLOT → **完全相同的 3 部位**` |
| Conditioning / HYROX 需要适配器 | `con-01 main.kind=PROTOCOL → incomplete`、`hyrox-skill main.kind=PROTOCOL → incomplete` |
| Body 仍是人工选择、0 张恢复卡 | `body-recovery.js` 源码含「如需拉伸，按当日训练肌群由教练人工选择」；预览 `recCards=0` |
| Conditioning 仍是纯文字 + NO POST CARDIO | 源码含 `NO POST CARDIO`；预览 `recCards=0` |
| HYROX 仍是 5 条文字要点 | `hyrox-recovery.js` 用 `<ul>` 渲染 items，非卡片 |
| #114 链：master 上 4/4 Family 的 L3=L4 逐字重复 | 实测 master 四个 Family **L3 与 L4 选择完全相同** |
| #114 链：分支形成 L1→L4 进阶 | 见下表 |
| #113：`con-01/l3` Station 从 2 → 3 | master `[STATION-1,STATION-2]` → 分支 `[BLOCK-A/STATION-1,BLOCK-B/STATION-1,BLOCK-C/STATION-1]` |
| 四条预览 PREP 标题与 select 类名逐字相同 | 见第四节探针表 |
| 四条预览 `泡沫轴=false`、`课后有氧选择器=false` | 见第四节探针表 |
| 副标题 bug 四条预览全部复现 | `#/coach/body/body-01`、`body-01/l3`、`con-01/l3`、`skill/l3` 均为 `Multi-Template Coach Center`；`js/app.js` 的 `labels()` 只处理 `template`/`template-compose`/`recipeId`，三条链的 `app.js` 与 master **逐字相同** |

Body 进阶链实测（`Body.candidates()` + resolve）：

```
Family   master L3 → L4                  #114 链 L3 → L4
BODY-01  半蹲哈克/徒手分腿蹲  (重复)        哈克深蹲/哑铃反向箭步蹲  →  哈克深蹲/保加利亚分腿蹲
BODY-02  杠铃硬拉/扶持单腿RDL (重复)        哑铃罗马尼亚硬拉/独立单腿RDL → 杠铃硬拉/高阶负重单腿RDL
BODY-03  低位划船/辅助宽握引体 (重复)       坐姿划船（变式）/辅助引体向上 → 自重引体向上/杠铃划船
BODY-04  上斜俯卧撑/器械推肩 (重复)         哑铃卧推/半跪姿地雷杆推举 → 器械胸推/半跪姿地雷杆推举
```

### ⚠️ 需更正的数字

| 上文写的 | 本轮实测 |
|---|---|
| 候选池 `7,4,4,4,4,4 → 8,8,6,2,2,2`（BODY-02 L3） | `master BODY-02 L3 = 8,14,8,6,6,6` → `分支 = 8,14,9,6,6,6`。**方向（池子变宽）成立，绝对值不成立** |
| `#113` = 221 pytest / **61** node | 实测 221 pytest / **61** node ✅（与上文一致，此处仅确认） |
| 「无任何分支改动 `prep-resolver.js` / `*-prep.js`」 | **只对 11 个「与 master 同步」的分支成立**。另有 3 个分支（#58/#63、`issue-90-hyrox-benchmark-history`）确有差异，但它们的 merge-base 落后 master 5–107 个提交（最早 2026-09-11），差异主要是**落后于 master**造成的删除噪声，不是新实现。结论仍成立，但措辞需限定为「没有任何**在 master 之上新增**的实现」 |
| 「5 个孤儿分支」 | `feature/issue-90-benchmark-hardening`（#119）是 **open PR 且 CLEAN**，不应与孤儿同列；本轮已把它并入拓扑一起算 |

### 🔴 新发现：`feature/issue-90-hyrox-benchmark-history` 会删掉 schema

该分支相对其 merge-base **删除了 `schemas/v14.8/hyrox.schema.json` 全部 868 行**（`git show <branch>:schemas/...` 返回 0 行）。这是破坏性变更，会让 schema 门禁失去覆盖，属**不可直接合并**的硬伤——它是三份撞车实现里最不该选的那一份。

## 四、四条预览的逐页探针与截图对照

探针原始数据：`docs/audit-assets-branches/R2-runtime-probes.json`
截图：`docs/audit-assets-branches/R2-{master,A118,B114,C113}-<route>-<width>.jpg`（61 张）

### 1a UI 不统一 —— 四条预览逐字相同（确证无人动过）

| 路由 | master / #118链 / #114链 / #113 |
|---|---|
| F111 | `2F｜PREP` + `.prep-slot-select` ×5 |
| Body | `PREP｜动态热身 / 激活` + `.body-prep-select` ×5 |
| Conditioning | `PREP / PRIMER｜动态热身 · 动作排演` + `.conditioning-prep-select` ×5 |
| HYROX | `PREP｜动态热身 · Station 准备` + `.hyrox-prep-select` ×5 |

四个模板**四行输出完全一致**，跨四条预览也无差异。

### 2a 泡沫轴 / 3c 课后有氧 / 副标题

| 探针 | master | A118 | B114 | C113 |
|---|---|---|---|---|
| `泡沫轴` 独立区块（F111） | true | true | true | true |
| `泡沫轴` 独立区块（Body / Conditioning / HYROX） | false | false | false | false |
| `课后有氧选择器`（全部模板） | 0 | 0 | 0 | 0 |
| 副标题 `Multi-Template Coach Center` | 4 条路由 | 4 条 | 4 条 | 4 条 |
| 空 `<h2>` | 0 | 0 | 0 | 0 |

> 注：Conditioning 的 `foamText=true` 是 PREP 动作名「泡沫轴仰卧肩屈上举」命中的正文文本，**不是**泡沫轴松解模块——与第一轮判断一致。

### 恢复卡实测

| 路由 | master | A118 | B114 | C113 |
|---|---|---|---|---|
| `f111-01/l3` `[data-recovery-card]` | 0（静态文字） | **3** | 0 | 0 |
| `body-01/l3` | 0 | 0 | 0 | 0 |
| `con-01/l3` | 0 | 0 | 0 | 0 |
| `hyrox skill/l3` | 0 | 0 | 0 | 0 |

A118 的 `f111-01/l3` 实拍：标题 `完成拉伸｜约 5–8 分钟`，3 张卡分别为 `髋前侧·髋屈肌` / `上背与腋下·背阔肌` / `臀部·臀肌`——与第一轮截图结论一致，本轮已重新起预览独立复现。

### 门禁之外顺带复现的 1b 附带项

`data/src/templates.json` 里 `body.capabilities = {composer:false, copy:false}`，但预览实测：

- `#/coach/body/compose?family=BODY-01&level=L1` **正常渲染**（`Body 自由编课`，副标题 `健美式塑形`）；
- Body 会话页存在按钮 **「复制教练版」「复制会员版」**。

声明与实际能力确实不符（与第一轮 A 节一致，本轮独立确认）。

## 五、5 个孤儿分支定性（只给建议，未删除）

| 分支 | 定性 | 依据 |
|---|---|---|
| `v147-bootstrap` | **可删**（历史脚手架） | merge-base 在 2026-09-14 之前，相对 master `-69454` 行、含 `.bootstrap-v147/p00.b64`、`.bootstrap-xz/x00.b64` 等分片 |
| `v147-bootstrap-clean` | **可删**（历史脚手架） | 同上，含 `.bootstrap-final/z0*.b64`，`-58656` 行 |
| `fix/body-ui-exercise-family-redundancy` | **死方案** | `redundancyGroup` 在 master 与 #114 链上 **0 引用**；已合并的 `exerciseFamily` 方案被采用（`js/resolvers/body.js` 9 处、`js/conflict-plugins/body.js` 3 处） |
| `fix/body-ui-variant-redundancy` | **无独立实现** | 相对 merge-base 仅 `playwright.config.js` + 2 个测试文件，无生产代码 |
| `feature/issue-90-hyrox-benchmark-history` | **需人工择一，且当前版本不合格** | 有 +875 行真实实现，但**删除 868 行 `hyrox.schema.json`**；与 #119（CLEAN）、#103（CONFLICTING）三份撞车。建议以 **#119** 为基线，从另两份选择性回收 |

## 六、行动结论

- **第 0 步（合并）**：拓扑验证已完成，推荐顺序 `#113 → #115 → #117 → #118 → #111 → #112 → #114 → #120 → #119 → #121`，共 7 处冲突，全部按第三类根因表处理。`js/views-coach.js` 的键盘导航二选一是**唯一需要人工决策**的语义冲突。
- **第 1 步（实现）**：第四节的探针表就是第 1 步 4)–8) 项的**验收基线**——Body/Conditioning/HYROX `recCards` 要从 0 变 3，泡沫轴要从 false 变 true，课后有氧选择器要从 0 变 1，副标题要从 `Multi-Template Coach Center` 变成模板名。

---

# 第 0 步已执行：本地集成合并（2026-09-17，第三轮）

- 集成分支：`integ/all-verified`，最终 HEAD `2e851b2`
- 起点 `master` @ `61beb976`，10 个 PR 分支全部合入，**81 个提交 / 106 个文件 / +16593 −498**
- **未推送、未改动 master、未删除任何孤儿分支**

## 1. 执行结果

| 序 | PR | 分支 | 结果 | 解决的文件 |
|---|---|---|---|---|
| 1 | #113 | `feature/issue-85-conditioning-blueprint` | ✅ 干净 | — |
| 2 | #115 | `feature/issue-73-prep-responsive-filters` | ⚠️ 3 处 | `assets/app.css` `js/views-coach.js` `playwright.config.js` |
| 3 | #117 | `feature/issue-79-auxiliary-modules` | ⚠️ 2 处 | `data/system-data.js` `playwright.config.js` |
| 4 | #118 | `feature/issue-80-recovery-ux` | ⚠️ 2 处 | 同上 |
| 5 | #111 | `feature/issue-93-body-level-pools` | ⚠️ 2 处 | `data/change-log.js` `data/system-data.js` |
| 6 | #112 | `feature/issue-94-venue-load-rules` | ⚠️ 4 处 | `data/change-log.js` `data/system-data.js` `js/state.js` `schemas/v14.8/action.schema.json` |
| 7 | #114 | `feature/issue-95-equipment-station-diversity` | ⚠️ 4 处 | `data/src/actions.json` `data/system-data.js` `playwright.config.js` `schemas/v14.8/action.schema.json` |
| 8 | #120 | `feature/issue-12-favorites` | ⚠️ 4 处 | `assets/app.css` `index.html` `js/state.js` `playwright.config.js` |
| 9 | #119 | `feature/issue-90-benchmark-hardening` | ⚠️ 2 处 | `assets/app.css` `tests/issue71_live_audit_browser.spec.js` |
| 10 | #121 | `feature/issue-13-evidence-review-metadata` | ⚠️ 5 处 | `assets/app.css` `data/change-log.js` `data/system-data.js` `playwright.config.js` `tools/validate_v148_schema.py` |

## 2. 冲突根因处理

- **`data/system-data.js`（9 次冲突）**：定位为生成物，**从不手工合并**。每次先合 `data/src/*.json` 源文件，再 `tools/build_system_data.py` 重新生成，并用 `--check` 校验自洽。
- **`playwright.config.js`（6 次冲突）**：结构性缺陷已根治，见第 3 节。
- **`assets/app.css` / `data/change-log.js` / `js/state.js` / `schemas/*.json` / `tools/validate_v148_schema.py`**：加法式并集。JSON 类改为「按对象解析后并集再回写」，避免文本拼接产生缺逗号的非法 JSON（首次文本并集曾产生 1 处 JSON 语法错误）。
- **`js/views-coach.js`**：按选定方案保留 **#115 的 `bindPrepSelect`**，并保留 #113 的 `event.defaultPrevented` 守卫，覆盖两处调用点，`bindPrepKeyboard` 0 残留。
- **`tests/issue71_live_audit_browser.spec.js`**：取 #119 版本（它是超集，多了 `targetSelect` 与 `toBeFocused()` 断言）。

## 3. 合并中真实踩到并修复的两个 bug（不跑浏览器门禁不会发现）

### bug 1：`playwright.config.js` 的 `testMatch` 是共享行

10 个分支里有 **12 个互不相同的 `testMatch`**，每次合并必然冲突。已改为**显式清单 ∪ 目录扫描**的计算式并集，新增 spec 变成一行且不再冲突，并顺带发现两个**从未被任何分支登记**的 spec：

```
body_equipment_station_browser.spec.js   （#114 新增）
issue80_recovery_browser.spec.js         （#118 新增）
```

`testMatch` 现在稳定解析为 19 条。

### bug 2：CSS 冲突解决的位置覆盖了移动端断点

把 #115 的 `.slot-actions` 规则补在样式表**末尾**后，它落在 `@media(max-width:620px)` 之后且特异性相同，导致 390px 下仍渲染两列，`issue73` 移动端点击目标断言失败（`Received ["220px","88px"]`）。#115 的规则本身已含 `min-width:0`，末尾那条是冗余，删除后恢复。**文本并集式解冲突的典型陷阱：位置本身就是语义。**

## 4. 集成后门禁（全绿）

| 门禁 | 结果 |
|---|---|
| `pytest -q` | **250 passed** |
| `for f in tests/*_test.js` | **70 passed / 0 failed** |
| `npx playwright test`（19 specs） | **62 passed** |
| `build_system_data.py --check` | PASS |
| `validate_v148_schema.py` | PASS |
| `node --check`（data + js） | PASS |
| `prepare_static_site.py` | PASS |

> 中途一次全量浏览器跑出现 4 个 HYROX 失败、另一次出现 `issue73` 失败，均为**我自己的验证环境干扰**（后台 `python -m http.server` 占住 Playwright 的 4173，命中过期 `_site`）；清理后洁净复跑为 62 passed。记录于此避免误判。

## 5. 集成预览与 master 对照（端口 4195）

探针：`docs/audit-assets-branches/R2-integrated-probes.json`；截图：`R2-INTEG-*.jpg`（24 张）

| 路由 | 指标 | master | 集成 |
|---|---|---|---|
| `f111-01/l3` | 恢复卡数 | 0 | **3** |
| `f111-01/l3` | 恢复区块标题 | `2F｜RECOVERY` | **`完成拉伸｜约 5–8 分钟`** |
| `body-01/L3` | 主项 / 次项 | 半蹲哈克 / 徒手分腿蹲 | **哈克深蹲 / 哑铃反向箭步蹲** |
| `body-01/L4` | 次项 | 徒手分腿蹲（与 L3 重复） | **保加利亚分腿蹲** |
| `con-01/l3` | Station 数 | 2 | **3（BLOCK-A/B/C）** |
| Body / Conditioning / HYROX | 恢复卡数 | 0 | 0（**仍是第 1 步的工作**） |
| Body / Conditioning / HYROX | 泡沫轴 | false | false（**仍是第 1 步的工作**） |
| 全部 | 课后有氧选择器 | 0 | 0（**仍是第 1 步的工作**） |
| 全部 | 横向溢出 | 0 | 0 |

**合并是安全的**——除预期内的三项功能差异外，其余探针与 master 逐项一致，无回归。

## 6. 数据保全专项验证（合并最易静默丢数据处）

第一版集成（错误顺序）曾出现 **`data/src/actions.json` 静默丢失 #118 的 14 条 `recoveryRegion` 元数据**——`git` 自动合并成功、无冲突标记、门禁也不报错，但拉伸匹配会退化成空。改为按推荐顺序重做并在**每一步**校验后确认：

```
                      master   集成后
RECOVERY_2F 动作数        14      14
  其中带 recoveryRegion    0      14   ← #118
  其中 passive_*           9       9
equipmentClass 条目        0      15   ← #117
stationGroup 条目          0       9   ← #114
stationId 条目             0       6   ← #114
恢复匹配器 f111/body    不可用   complete 3 部位
条件训练 con-01/l3 Station   2       3   ← #113
```

> **教训：多分支合并后必须对「数据字段是否存活」做断言，不能只看合并退出码。** `data/system-data.js` 是生成物，重新生成会用 `data/src` 覆盖它——若源文件合并时丢字段，生成物会「合法地」丢掉该字段。

## 7. 仍未解决（留给第 1 步）

集成后缺口与第二轮探针完全一致，未因合并而改变：

1. **Body 仍未接 `V14RecoveryMatcher`** —— 数据已能产出与 F111 相同的 3 部位，只差 `body-recovery.js` 调用（近乎零成本）
2. **Conditioning / HYROX 需要 PROTOCOL 适配器** —— 两者 `main.kind=PROTOCOL`，matcher 返回 `incomplete`
3. **泡沫轴未接入** Body / Conditioning / HYROX
4. **课后有氧选择器**仍不存在，`venue_treadmill_zone2` / `venue_stair_zone2` 仍无运行时消费方
5. **热身个性化 / UI 统一 / 副标题 / Body 层级 / 踝足膝节点** —— 与第二轮结论相同，无分支处理

---

# 第 1 步已执行：恢复/拉伸统一到四个模板（2026-09-17，第四轮）

- 分支：`integ/all-verified`，新提交 `c3b88f5`
- 范围：**只做恢复/拉伸**（第 1 步的 4) 项）。泡沫轴、课后有氧、热身个性化、UI 统一均未触碰。

## 1. 做了什么

| 模板 | 之前 | 现在 |
|---|---|---|
| F111 | 3 张动态匹配卡（#118） | 不变 |
| **Body** | 一句「按当日训练肌群由教练人工选择」 | **3 张匹配卡** |
| **Conditioning** | 纯文字 + NO POST CARDIO | **3 张匹配卡** + 保留 NO POST CARDIO |
| **HYROX** | 5 条文字要点 | **3 张匹配卡** + 保留 5 条动态要点 |

四者标题统一为 `完成拉伸｜约 5–8 分钟`，各自保留自己的边界说明（Body「不计入 Direct Work Sets」、Conditioning「NO POST CARDIO」、HYROX 负荷边界）。

**Body 几乎白捡**：它的 `main.kind` 已是 `SLOT`，matcher 本来就能算出 3 个部位，只是 `body-recovery.js` 从没调用过。改动 = 让它接收 session 并调用 matcher，再把匹配结果带进复制文案。

## 2. 新增 `js/recovery-protocol-adapter.js`

Conditioning / HYROX 是 `main.kind=PROTOCOL`，matcher 在那里**无从下手**，原因是数据本身不可用：

- Conditioning 的 station action 把**器械模式名**塞在 `pattern` 里（`稳态` / `间歇`），`loadFamily` 为空；
- HYROX 的 station id（`HYROX-H1`…）在动作表里**根本没有记录**（`anatomyContext` 的 primary/secondary 全空）。

适配器把这二者翻译成 RECOVERY_2F 元数据声明的同一套词汇：

- **Conditioning → 该 station 的策展解剖记录**（真数据驱动，每站都有 primary/secondary）。
- **HYROX → H1–H8 规范站点表**（该项目的站点表是固定事实），未知 id 回退到 `modality`。
- 主发力肌权重 5、协同肌权重 2；每个 demand 词单独成条，matcher 的单术语契约不变。

## 3. 顺带修掉一个会让功能「名存实亡」的缺陷

接上适配器后，**24 条 Conditioning/HYROX 会话全部返回同一组三张卡**（肩后侧/臀部/髋前侧）。根因与审计第一轮发现的 PREP 饱和问题**同源**：评分对全部信号求和，于是「声明目标词最多」的通才候选（臀肌拉伸 = 4 pattern + 3 load）必然胜出，专才永远排不上。

修法：对 PROTOCOL 信号引入**术语稀有度加权**（`ln(1+mass/freq)`，罕见的 demand 判别力更高）+ **按本节实际命中的负荷取平均**（而非按候选声明的目标数）+ 一条**支配位保护规则**（负荷最大的下肢部位固定进卡）。

关键决策：**这套调优只作用于 PROTOCOL 路径**。SLOT 路径（F111 / Body）保持逐字不变——已合并、已测试、已写进本报告的 F111 行为不应被顺手改掉。经全矩阵核验：

```
F111 8 预设 × L1–L4 = 32 行 + Body 4 Family × L1–L4 = 16 行
改动前后 diff = 空（逐字一致）
```

标的 24 行 PROTOCOL 结果则从 **1 种 → 9 种**。

## 4. 门禁（全绿）

| 门禁 | 结果 |
|---|---|
| `pytest -q` | **250 passed** |
| `for f in tests/*_test.js` | **71 passed / 0 failed**（新增 `recovery_protocol_adapter_runtime_test.js`） |
| `npx playwright test`（19 specs / 62 用例） | **62 passed** |
| `build_system_data.py --check` | PASS |
| `validate_v148_schema.py` | PASS |
| `node --check`（data + js） | PASS |
| `prepare_static_site.py` | PASS |

同步更新的断言（它们原本锁的是**我们这次要改掉的旧行为**）：
`body_recovery_browser.spec.js`、`body_coach_copy_test.js`、`body_coach_session_runtime_test.js`、
`conditioning_coach_copy_test.js`、`conditioning_coach_session_runtime_test.js` —— 由「断言固定文案」改为「断言 3 张匹配卡 + 保留各自边界」。

## 5. 浏览器实测（真实 DOM，非推断）

四条预览路由的恢复区实测（agent 浏览器，端口 4290，构建号 `step1`）：

```
Body  body-01 L3  完成拉伸｜约 5–8 分钟
      上背与腋下·背阔肌拉伸·45 秒·作为训练后主要部位恢复建议
      臀部·臀肌拉伸·45 秒·匹配本节的膝主导负荷
      髋前侧·髋屈肌拉伸·45 秒·匹配本节的膝主导负荷
      + 恢复边界 恢复内容不计入 Direct Work Sets。

Cond  con-01 L3   完成拉伸｜约 5–8 分钟
      上背与腋下·背阔肌拉伸·匹配本节的上肢拉负荷   ← 认出划船/滑雪的拉负荷
      臀部·臀肌拉伸 / 髋前侧·髋屈肌拉伸
      + NO POST CARDIO 保留

HYROX skill L3    完成拉伸｜约 5–8 分钟
      肩后侧·教练被动肩后侧拉伸 / 小腿后侧·教练被动小腿后侧拉伸 / 髋前侧·髋屈肌拉伸
      + 5 条动态要点保留
```

**全模板扫描（48 条路由无一例外）**：`docs/audit-assets-branches/S1-recovery-card-sweep.txt`

```
Body 4 Family × L1–L4 = 16     全部 cards=3
Cond 4 Family × L1–L4 = 16     全部 cards=3
HYROX SKILL/MIXED × L1–L4 = 8  全部 cards=3
F111 8 预设 × L3 = 8           全部 cards=3
→ 无一条路由出现 0 张或不足 3 张
```

分化结果：48 条路由产出 **7 组不同的部位组合**（PROTOCOL 部分）。样例：
`CON-01`（划船/滑雪，拉主导）→ 上背与腋下 / 髋前侧 / 臀部；`CON-04`（腿部主导）→ 胸前侧 / 臀部 / 小腿后侧；
`BODY-02/03` → 大腿后侧；`BODY-04` → 肩后侧；
**`臀部` 在 48/48 条路由全部出现**（含此前被挤掉的 5 条 HYROX），**`小腿后侧` 出现在 12/48**（全部在 Conditioning / HYROX，F111 与 Body 不受影响）。

截图：`S1-body-recovery.png`、`S1-cond-recovery.png`、`S1-hyrox-recovery.png`、`S1-hyrox-glute-calf.png`（HYROX MIXED L4：上背与腋下 / **臀部** / **小腿后侧**）

## 6. 本轮踩到并更正的坑（流程教训）

**端口冒名**：我用 4198 起预览时 bind 失败（端口已被**另一个 worktree** `~/.codex/worktrees/...issue-73` 占用），`curl` 仍返回 200，于是浏览器看到的是**别人的构建**——表现为 `V14RecoveryMatcher: undefined`、旧标题。同一检查还发现 **4191 也不是我的**（属 `issue-85` worktree），我在第三轮说过的「master 在 4191」**是错的**，在此更正。

**新规矩**：起预览后必须验证两件事才算数——

```
lsof -p <pid> | grep cwd      # 目录是我要的那个
curl index.html | grep '?v='  # 构建号是我这次的
```

本次最终预览（端口 4290）已按此验证：`cwd=/private/tmp/prev/step1`、`?v=step1`。

## 7. 第 1 步剩余项（未做）

1. 泡沫轴复用 `M.Foam` 接入 Body / Conditioning / HYROX（**小腿后侧的泡沫轴松解属于这一步**）
2. 课后有氧选择器（器械/时长/平均心率/可复制）
3. 热身个性化：修 `prep-resolver.js` 排序权重与 `targetPatterns` 饱和
4. 统一 5 套 PREP 类名、修副标题 fallback、Body 层级压到 2 步、补踝/足/膝活动度节点

---

## 8. 恢复/拉伸的选法修正（`ffe01bd` + `a144200`）

教练指出两条根本性错误，原实现都违反了：

> 「小腿后侧是可以放到泡沫轴里面进行松解的。」
> 「课后恢复的拉伸，一般你看主训练和辅助训练用到哪些大肌群，用到得多的你就拉伸哪些。**每个部位分别拉伸 1 个动作，做 3 个左右的拉伸动作**就可以了。你不要搞错了。」

### 错在哪

| 错误 | 表现 |
|---|---|
| **小腿后侧被当成拉伸** | 12/48 条路由给出「教练被动小腿后侧拉伸」卡。应按教练做法归入 PREP 泡沫轴 |
| **按动作模式匹配，而非按练到的肌群** | `蹲` 模式命中了「大腿内侧」的目标词，于是**没练内收肌**的课也拉伸内收肌；「三角肌前束」推举映射成「胸」，**没练胸**的课也拉伸胸 |
| **固定「1 上肢 + 2 下肢」硬凑** | `BODY-01 臀腿｜股四主导`（纯腿日，6 个动作全是下肢）被开出**背阔肌**拉伸；`BODY-04 胸肩臂`（纯上肢日）被开出**臀部 + 大腿后侧**拉伸 |
| **不足 3 个部位时用优先级兜底** | `BODY-03 背肩塑形` 实际只练到 2 个可拉伸部位，第 3 张被兜底逻辑塞进**臀部** —— 同一个错误换了个入口 |

### 现在的规则（实现即教练原话）

1. 取该节课**主训练 + 辅助训练实际练到的肌群**（`anatomyContext` 或各 Station 的策展解剖记录），按暴露量排序（主发力 ×5 / 协同 ×2 / 稳定 ×1）。
2. **只从练到的部位里选**，每个部位 1 个动作，**取前 3**，**不再固定上肢下肢配额**。
3. **小腿后侧不参与拉伸选择**（`FOAM_ROLL_ONLY_REGIONS`），留给泡沫轴那一步。
4. 兜底只在「练到的部位不足 3 个」时启用；`三角肌后束` 已从 `upper_back` 改判到 `肩后侧`，因此各 Body Family 都有 3 个真实练到的部位，兜底不再被触发。

### 修正后的对照（真实浏览器实测，48 条路由）

| 状态 | 修正前 | 修正后 |
|---|---|---|
| `BODY-01 臀腿｜股四主导`（纯腿日） | 上背与腋下 · 臀部 · 髋前侧（**拉了没练的背**） | **臀部 · 大腿后侧 · 髋前侧**（全下肢） |
| `BODY-03 背肩塑形`（纯上肢日） | 上背与腋下 · 臀部 · 大腿后侧（**拉了没练的腿**） | **上背与腋下 · 胸前侧 · 肩后侧**（全上肢） |
| `BODY-04 胸肩臂`（纯上肢日） | 肩后侧 · 臀部 · 大腿后侧（**拉了没练的腿**） | **胸前侧 · 上背与腋下 · 上臂后侧**（全上肢） |
| `CON-04`（腿部主导） | 胸前侧 · 臀部 · 大腿内侧（**大腿内侧只做壶铃摇摆的协同肌**） | 臀部 · 髋前侧 · 胸前侧（按暴露量 27 / 22 / 10） |
| 小腿后侧出现次数 | 12 / 48 | **0 / 48**（归入泡沫轴） |
| 卡片数 | 48/48 恰好 3 张 | **48/48 恰好 3 张**，且无一条来自未训练部位 |

证据：`docs/audit-assets-branches/S1-recovery-card-sweep.txt`（48 条路由逐条列出选中部位）

### 验证方式

- 门禁：250 pytest / 71 node / 62 Playwright 浏览器用例全过。
- `tests/recovery_protocol_adapter_runtime_test.js` 现在直接断言**规则本身**：每条路由选中的必须就是暴露量前 3 的部位，且 `BODY-01` 不得出现「背部」暴露、`BODY-04` 不得出现腿部拉伸、小腿后侧任何模板都不得入选。
- 浏览器实测：48 条路由（Body 16 / Conditioning 16 / HYROX 8 / F111 8）由 Chromium 真实渲染后逐个读取 `[data-recovery-card]`。

---

> 历史附注（`f976759`，已被第 8 节取代）：中途曾用「按动作声明的目标数做阻尼」调 PROTOCOL 的候选排序，导致小腿把臀部挤出 5/8 条 HYROX 会话。该调参机制**已整体删除**——它存在的前提是「按动作模式匹配」，而这个前提本身已被证明是错的。

---

## 9. 泡沫轴接入三模板（`7392de4`）

第 1 步第 1 项。此前 `M.Foam` **只有 F111 能到**：Body / Conditioning / HYROX 的 PREP 区只渲染热身槽位，**0 张泡沫轴卡**（第一轮审计 C 节结论，本轮实测复核仍成立）。

### 做了什么

1. **新入口 `M.Foam.rankForSession / itemsForSession / foamRollCardsFor`** —— 原 `foamRollCards(recipeId,level,ids)` 依赖 `data.recipes[recipeId]`，而 `recipes` 是 F111 专有；新入口用显式 title/subtitle，模板无关。
2. **排序口径与拉伸统一**：复用同一个 `muscleExposure(session)`，按泡沫轴目录的「肌群 → 动作」映射（`V14_ANATOMY.foamByMuscle`，16 肌群 → 12 动作）打分取前 4。**同一节课的拉伸和松解看的是同一份肌群暴露量。**
3. **注入三个 PREP 区**：放在热身卡之前，与 F111 结构一致；`body-prep` / `hyrox-prep` 增加 `session` 形参（`conditioning-prep` 已有）。
4. **复制文案**：三个模板的教练版/会员版新增 `【泡沫轴松解】` 段（此前三个模板的复制载荷里**完全没有泡沫轴**）。
5. **HYROX 站点表改以肌群为单一事实来源**（`HYROX_STATIONS[].muscles`），拉伸区域由肌群推导 —— 一份数据同时供拉伸与松解，不再两处维护。

### 小腿后侧的归属（教练明确要求）

`腓肠肌 / 比目鱼肌 → FOAM-12 泡沫轴松解-小腿`。所以：

- **泡沫轴**：练到小腿的课会出现（`BODY-02`、`CON-02`、`CON-04`）
- **拉伸**：任何模板都不出现（第 8 节的 `FOAM_ROLL_ONLY_REGIONS`）

### 实测（真实浏览器，11 条路由）

```
BODY-01 L3（纯腿日）  臀部 / 大腿后侧 / 大腿内侧 / 大腿前侧        ← 全下肢
BODY-03 L3（纯上肢日）肩部 / 肱二头肌 / 背阔肌 / 竖脊肌旁          ← 全上肢
CON-04 L3（腿部主导） 臀部 / 大腿前侧 / 【小腿】 / 肩部
HYROX SKILL L3       臀部 / 大腿前侧 / 背阔肌 / 胸大肌
```

- **11/11 条路由渲染 4 张泡沫轴卡**，且同一页恢复区仍是 3 张拉伸卡（两区互不影响）。
- 小腿后侧出现在 `BODY-02` / `CON-02` / `CON-04` 三条真正练到小腿的课。

证据：`docs/audit-assets-branches/S1-foam-sweep.txt`、`S1-foam-cond04-calf.png`、`S1-foam-body01.png`

### 门禁

250 pytest / **72 node**（新增 `tests/foam_session_runtime_test.js`）/ 62 Playwright 浏览器用例，build + schema + 语法 + 静态站全 PASS。

该测试锁的关键不变量：每个模板都能产出泡沫轴项、项数 ≤ 4 且等级合法、**每张卡都必须对应本节真的练到的肌群**、练到小腿的课必须给小腿、纯腿日的松解必须全是腿、纯上肢日的松解不得出现腿。

---

## 10. 课后有氧选择器（`e6ab09c` + `946f104`）

第 1 步第 2 项，对应第一轮审计 G 节。

### 改之前是什么样

同一件事在**三个地方各写了一遍，而且措辞不一致**：

| 位置 | 内容 |
|---|---|
| `data/src/sessions.json` | 静态句子 `POST CARDIO ONLY｜课后有氧 跑步机课后自主有氧 / 楼梯机课后自主有氧 不计入…` |
| `js/session-copy.js:26` | 会员版硬编码：`选择跑步机爬坡、爬楼梯机、快走或其他有氧，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。` |
| `js/coach-copy.js:5-7` | 教练版硬编码三行，与上面**措辞不同** |

而数据层早就有两台器械（`venue_treadmill_zone2` / `venue_stair_zone2`，route `POST_CARDIO_ONLY`），**`js/` 里没有任何代码消费这个 route** —— 与第一轮结论一致。

### 现在

新增 `js/coach/post-cardio.js`：

1. **器械选项来自数据**：读 `POST_CARDIO_ONLY` 动作生成「跑步机 / 楼梯机」，保留「其他有氧」（旧文案一直承诺快走/其他）。
2. **三控件 + 复制**：器械 / 时长（20–45 分钟）/ 平均心率（120–130 … 150–160 bpm），带 `复制本模块`。
3. **独立存储**：该区块文档上就写明「不计入 60 分钟力量模板」，所以给了它**自己的 per-session 存储**，而不是塞进 resolved-session 状态。预设课与自由组合课各有独立 state key（`F111-01-L3` / `F111-C-SQ-HR-L3`），互不影响。
4. **复制同源**：`coach-copy.js` 与 `session-copy.js` 都改为读同一份 plan，**结构上不可能再漂移**。
5. **默认值刻意复现原文案**（跑步机 / 30 分钟 / 130–140），所以既有复制断言全部继续成立，而每个值都变成了可选的。
6. 静态 `post-cardio-note` 从两个 F111 界面（预设 + 自由组合）移除；标题仍是 `POST CARDIO ONLY`，因此查找该标签的断言不受影响。

### 实测（真实浏览器，端口 4298）

```
默认：跑步机 · 约 30 分钟 · 平均心率 130–140 bpm
      教练版 → 课后有氧｜约 30 分钟 / 器械：跑步机 / 平均心率：130–140 bpm 左右（燃烧脂肪心率）
      会员版 → 课后有氧｜约 30 分钟 / 选择跑步机，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。

改成 楼梯机 / 40 分钟 / 140–150：
      徽标    → 约 40 分钟
      摘要    → 楼梯机 · 约 40 分钟 · 平均心率 140–150 bpm
      教练版  → 课后有氧｜约 40 分钟 / 器械：楼梯机 / 平均心率：140–150 bpm 左右（燃烧脂肪心率）
      会员版  → 课后有氧｜约 40 分钟 / 选择楼梯机，时间 40 分钟左右，平均心率 140 到 150 左右（燃烧脂肪心率）
      pageerror → 0
```

### 顺带修掉的一个真 bug（`946f104`）

`bindPostCardio` 定义在 `bind(route)` **之外**，拿不到那个作用域里的局部 `rerender`。结果：`setSelection` 已经把新计划写进存储，紧接着抛 `ReferenceError`，**下拉框显示新值、徽标与摘要却停在旧值**。改为传入 `rerender`（与该块其它处理器一致）后重绘正常。这个 bug 只在真实交互里暴露，静态检查和单元测试都发现不了。

### 门禁

250 pytest / **73 node**（新增 `tests/post_cardio_runtime_test.js`）/ 62 Playwright 浏览器用例全过，build + schema + 语法 + 静态站 PASS。

证据：`docs/audit-assets-branches/S1-post-cardio-selector.png`、`S1-post-cardio-verify.txt`

---

## 11. 热身个性化（`0b9d336`）

第 1 步第 3 项。审计 E 节给了四条根因；本轮逐条复现后，发现**真正致命的是第五条、而且比审计写的更深**。

### 复现基线（真实路径：`resolver → prepContext → PrepResolver.resolve`）

```
L1: 5 种 / 8 预设     L2: 4 种
L3: 2 种 / 8 预设     L4: 3 种     合计 14 / 32
```

与审计数字**逐格吻合**（审计 L1=5 / L2=4 / L3=2 / L4=3）。

### 根因（按影响排序）

| # | 根因 | 证据 |
|---|---|---|
| 1 | **解剖信号是死的**：排序里本来就有 `anatomyOverlap`，但解剖层说**肌肉**（股四头肌/臀大肌/背阔肌），PREP 节点说**部位**（踝/肩胛/髋/胸椎/臀部）。两套词汇只有 4 个名字重合，于是**任何一节课的最佳候选都只命中 1/5 个部位**，这个项等于常数 | 实测：F111-01 L3 最佳 anatHit=1/5；F111-03 L3 也是 1/4 |
| 2 | **模式项饱和**：52 个节点里 21 个声明全部 8 个模式，`patHit` 恒等于 2 | 实测 patHit 全为 2/8 |
| 3 | 排序主键错位：`gradeRank` 压制 `slotScore` | `items.sort` 首键即 gradeRank |
| 4 | 等级窗口没打散：L3 五个槽位全落 P3 | 实测 `[P3,P3,P3,P3,P3]` |
| 5 | **活动度槽位的门控只看自由文本**：`textOf` 含 `why`，于是「平板支撑交替抬腿」因为描述里提到「髋」就混进**下肢/髋踝活动**槽 | 实测 L3 MOB-L = 平板支撑交替抬腿 / 鸟狗式 |

### 修法

1. **给两套词汇搭桥**：`MUSCLE_REGION_BRIDGE`（18 条关键词规则）把肌肉映射到 PREP 的部位词表；命中数**按节点自身部位数归一化**，避免「列得多就赢」。
2. **模式按全库稀有度加权** `ln(1 + 总数 / 频次)`：只有少数节点准备的模式才值钱。
3. **加入主动作 tier 匹配**（`mainTiers`）—— 不写进上下文，因为 ResolvedSession 契约严格校验 `prepContext`，多一个键就报 `prepContext.mainTiers: is not allowed`，改为在 resolver 内部从 `mainActionIds` 推导。
4. **fit 优先**：`fit → 等级距离 → gradeRank → slotScore → curatedPriority → prepId`。
5. **活动度槽位认 `role`**：`role` 才是节点的用途。要求「不是核心类角色」+ 命中本槽位该有的区域（下肢 or 上肢），平板支撑/鸟狗式因此被挡在外。

> 关于「等级窗口打散」：我按审计建议试过**强制**每槽位指定等级（P1/P2/P2/P3/P3）。实测**反而更差**——多样性 20/32（低于 21）、且 L3 下肢槽掉到 P1 后选出「仰卧双腿伸直保持」当髋踝活动。撤销强制后，等级由 fit **自然散开**（L3 出现 `[P2,P3,P2,P3,P3]`、`[P2,P2,P1,P3,P3]` 等混合），审计要的递进效果达成且质量更好。

### 结果

```
L1: 7 种    L2: 4 种    L3: 6 种    L4: 6 种     合计 23 / 32（原 14）
```

L3 从 2 → 6（审计最在意的一格）。选出来的都是**真正的活动度动作**：动态90/90髋旋转转换、四足跪姿胸椎旋转、泡沫轴仰卧肩屈上举、单腿臀桥…

证据：`docs/audit-assets-branches/S1-prep-diversity.txt`

---

## 12. UI 统一（`ba2525f` + `03128fb`）—— 3/4 完成

### ✅ 副标题 fallback bug

`js/app.js` 的 `labels()` 只处理 `template` / `template-compose` / `compose` / `recipeId`，**没有** `template-family` 与 `template-session`，于是非 F111 的每一页都落到占位串 `Multi-Template Coach Center`。现在按 `模板 · Family/Station 类型 · 等级` 组合：

```
#/coach/body              健美式塑形
#/coach/body/body-01      健美式塑形 · 臀腿｜股四主导
#/coach/body/body-01/l3   健美式塑形 · 臀腿｜股四主导 · L3
#/coach/conditioning/con-01/l3   体能训练 · 基础有氧 · L3
#/coach/hyrox/skill/l3    HYROX 训练 · 技术学习 · L3
```

### ✅ 5 套 PREP 类名统一（叠加式）

5 处实现各自一套类名，导致「那个 PREP 区块」根本无法用一个选择器命中。现在**在保留原类名的同时**叠加共享钩子 `prep-section` / `prep-card` / `prep-select` / `prep-grid`，既有选择器与测试全部不受影响，同时一个选择器可覆盖全部 5 处。

实测 5/5：

```
F111 预设      prep-section=1 prep-card=5 prep-select=5（legacy prep-slot-select=5）
F111 自由组合   同上
Body          同上
Conditioning  同上
HYROX         同上
```

（过程中发现两处自己的疏漏并修掉：F111 预设的 PREP 区在 `session.js` 而不在 `prep.js`；`body_coach_session_runtime_test.js` 的加载清单里**没有** `body-prep.js`，所以它此前从未渲染过 PREP 区。）

### ✅ 补踝 / 足 / 膝活动度节点

数据缺口很具体：**场馆自己的踝背屈动作 `huan_jie_qianyi`（踝关节前移）根本没有 PREP 节点** —— 动作存在，但缺 `warmupEligible` 标记，resolver 永远选不到它（`isActionPrepEligible` 要求 `prepEligible`/`warmupEligible`/`usageDomains` 三者之一）。而 `膝` 此前只出现在「药球深蹲推举」这类全身整合动作里，**没有专属节点**。

做法：给该动作补 `warmupEligible: true` + `prepGrades:['P1','P2']`，新增 **PREP-51 踝关节前移（膝触墙）**，`regions:['踝','足部','膝']`（这个动作本身就是「膝盖沿第二脚趾推过脚尖」，天然同时覆盖踝背屈与膝轨迹），P1 档、全等级可用。

实测：节点进入 MOB-L 候选列表的状态数 5/32；全库 PREP 节点 52 → 53（已同步更新 `prep_core_expansion_test.js` 的总数断言并加了三项新断言）。

### ❌ 未做：Body 层级压到 2 步

这是**导航结构改造**，不是改文案：`body-home.js` 现在是「6 张训练模式科普卡 + 4 张 Family 卡」，要压成 2 步需要把 Family 矩阵直接提到首页、并处理 `#/coach/body/<family>` 这一层路由的去留，会牵动 `router.js` 与多个断言 Body 首页结构的测试。**我没有动它**，留作下一步。

### 门禁

250 pytest / **74 node**（新增 `tests/prep_personalization_runtime_test.js`）/ 62 Playwright 浏览器用例全过，build + schema + 语法 + 静态站 PASS。

证据：`docs/audit-assets-branches/S1-subtitle-and-hooks.txt`、`S1-prep-diversity.txt`

---

## 13. Body 层级压到 2 步（`e23c95f`）—— UI 统一最后一项完成

### 问题

Body 是**唯一**首页不让选等级的模板。F111 / Conditioning / HYROX 都是「首页即矩阵」，只有 Body 是：

```
编课中心 → Body 首页（6 张模式卡 + 4 张 Family 卡，只有「查看 X →」）
        → Family 页（仅 L1–L4）→ 课程            = 3 次点击
```

### 改法

Family 卡**直接带上 L1–L4 四个直达链接**，Family × 等级在一页选完。Family 页保留为**详情页**（动作池 / 进阶链 / 自由编课入口），但不再是必经层。

> 一个旁证：`assets/app.css` 里**早已存在** `.body-family-card .level-links{margin-top:auto}` —— 说明「Family 卡直接带等级链接」**本来就是原设计**，等级只是后来被挪到了第二页，样式却留着。这次是把设计恢复回去。

### 实测（端口 4302，构建号 body）

```
click 1 -> #/coach/body
click 2 -> #/coach/body/body-02/l3      session visible: true
首页结构: families=4  levelRows=4  levelLinks=16  modes=6
```

**3 次点击 → 2 次点击**，与其它三个模板一致。

### 锁住旧结构、已同步更新的三处断言

这三处都是**把旧决策写死在测试里**的典型，我没有绕开，而是改成断言新契约：

| 文件 | 旧断言 | 新断言 |
|---|---|---|
| `body_coach_browser.spec.js` | `.body-family-card .level-links` **必须为 0**、`a[href*="/l1"]` 必须为 0 | 必须为 **4**；并新增**从 `#/coach` 点两次直达课程**的端到端断言 |
| `body_coach_session_runtime_test.js` | `assert(!home.includes('.../l1'),'must not expose Level links on home')` | 四个等级链接都必须存在 |
| `browser_smoke.spec.js` | 标题文字「先选择本节训练 Family」 | 「选择本节训练 Family 与等级」 |

### 门禁

250 pytest / 74 node / 62 Playwright 浏览器用例全过，build + schema + 语法 + 静态站 PASS。

证据：`docs/audit-assets-branches/S2-14-body-home-2step.png`、`S2-body-2step-verify.txt`

---

## 第 1 步：全部完成

| # | 项目 | 状态 | 提交 |
|---|---|---|---|
| 4 | 恢复/拉伸统一到四个模板（Body 接 matcher + PROTOCOL 适配器） | ✅ | `c3b88f5`…`a144200` |
| 5 | 泡沫轴接入 Body / Conditioning / HYROX（含小腿） | ✅ | `7392de4` |
| 6 | 课后有氧选择器（器械/时长/平均心率/可复制） | ✅ | `e6ab09c` + `946f104` |
| 7 | 热身个性化（`prep-resolver` 排序与饱和） | ✅ | `0b9d336` |
| 8a | 副标题 fallback | ✅ | `ba2525f` |
| 8b | 5 套 PREP 类名统一 | ✅（叠加共享钩子） | `ba2525f` + `03128fb` |
| 8c | Body 层级压到 2 步 | ✅ | `e23c95f` |
| 8d | 补踝/足/膝活动度节点 | ✅（1 个踝/足/膝节点；专属的足内在与膝控制动作需新增策展动作，未杜撰） | `ba2525f` |

第 0 步（合并）见第 3 节，第 1 步见第 4–13 节。

---

## 14. 合回 master 并推送（生产发布）

### 发布前门禁（CI 等价，全部在待发布的那个 commit 上跑）

```
pytest 250 / node 74 / Playwright 62
build_system_data --check / validate_v148_schema / node --check       全 PASS
prepare_static_site + build-id 注入 + __BUILD_ID__ 无残留 + artifact hygiene  全 PASS
```

推送前还确认了三件事：`origin/master` 仍是 `61beb976`（无人推新提交，可快进）；集成分支**跟踪的文件里没有任何审计产物**（不会和我未跟踪的 docs 冲突）；10 个 PR 分支的提交**全部已是集成分支的祖先**。

### 执行

```
git fetch origin --prune            # origin/master 仍为 61beb976
git checkout master && git merge --ff-only integ/all-verified
git push origin master              # 61beb97..e23c95f
```

**快进**，因此 master 上保留了每个 PR 的合并提交，10 个 PR 的分支历史完整可追溯，没有压扁。

### PR 收口：自动关 6 个 + 人工关 4 个

GitHub 只在提交落到 PR 的 **base 分支**时才自动关闭。10 个里有 4 个是**堆叠 PR**（base 指向另一条 feature 分支而非 master），所以没被自动关：

| 处理 | PR |
|---|---|
| GitHub 自动关闭 | #111 #113 #115 #119 #120 #121 |
| 人工关闭（提交已在 master，已附说明） | #112 #114 #117 #118 |
| **保持 open（确实未合并）** | **#116**（`feature/issue-74-security-regression`，我只合了 115→117→118，**没有合 116**） |
| 保持 open（已知冲突） | #58 #63 #103 |

> #116 是差点误关的一个：它在列表里显示 `MERGEABLE`、base 也是 #115 那条链，但 `git merge-base --is-ancestor` 明确显示**不在 master 里**。逐个核对而不是批量关闭，避免了误操作。

### CI 与线上验证

| 运行 | 结果 |
|---|---|
| Deploy（`e23c95ff`） | verify ✅ / browser-smoke ✅ / deploy ✅ |
| Deploy（`845f9fd7`，见下） | verify ✅ / browser-smoke ✅ / deploy ✅ |

线上 `https://qinronghai.github.io/7fit-training-system-live/` 真实浏览器冒烟（构建号 `845f9fd7`）：

```
#/coach/body/body-01/l3  副标题=健美式塑形 · 臀腿｜股四主导 · L3
                         恢复=臀部/大腿后侧/髋前侧   泡沫轴=臀/大腿后侧/大腿内侧/大腿前侧
#/coach/conditioning/con-04/l3  恢复=臀部/髋前侧/胸前侧  泡沫轴含小腿=true  NO POST CARDIO=true
#/coach/f111/f111-01/l3  恢复卡=3  课后有氧选择器=3 个 select  摘要=跑步机 · 约 30 分钟 · 平均心率 130–140 bpm
#/coach/body             Family 卡=4  等级直达链接=16
pageerror = 0
```

### ⚠️ 我犯的一个错误（已修复并再次推送）

我把一个 **`node_modules` 符号链接推进了仓库**。经过：

1. 为让集成 worktree 能解析 Playwright，我在 worktree 里建了 `node_modules` 符号链接；
2. 随后 `git add -A`（提交 `3da9ad3`）**把这个符号链接当成文件提交了** —— `.git/info/exclude` 里写的是 `node_modules/`（**带尾斜杠，只匹配真实目录，不匹配符号链接**），所以没被挡住；
3. 链接内容是**我本机的绝对路径**，于是任何一次 checkout master 都会把工作区的 `node_modules` 目录替换成**指向自己的死循环链接** —— 我本地 `git merge --ff-only` 时就中招了，Playwright 直接报 `Too many levels of symbolic links`。

排查与修复：

- 全量审计被跟踪的本地垃圾：**只有 `node_modules` 一个**（`_site` / `.venv` / `test-results` / `.pytest_cache` / `.dsh-vision-router` 均为 0），且树里没有其它符号链接；
- `git rm --cached node_modules` 取消跟踪 + 提交 `845f9fd` 并推送；GitHub 上该路径现返回 404；
- 本地按 CI 同款命令 `npm install --no-save --no-package-lock @playwright/test@1.63.0` 恢复 `node_modules` 为真实目录，并**用仓库自身跑通 62 个浏览器用例**确认环境恢复；
- `.git/info/exclude` 追加不带斜杠的 `/node_modules`，防止符号链接再次漏网。

**线上站点未受影响**：`prepare_static_site.py` 按显式文件清单复制，不会带上多余的 `node_modules`。两次部署都成功，线上冒烟 0 错误。

### 当前状态

```
master = 845f9fd（已推送，Pages 已部署）
本地遗留分支 integ/all-verified = e23c95f（内容已全部进入 master，可删）
仍 open 的 PR：#58 #63 #103（已知冲突）、#116（真未合并）
```

