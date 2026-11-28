---
target: 训练体系中的热身板块页面和规则的设计逻辑
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/Users/ronny/program/7fitWebOS/js/views-system.js"
target_fingerprint: "sha256:d5e4c84ab2496a0977a6bc0b954a1caedd6f5b2779e993728349442ec3a0003b"
target_path: /Users/ronny/program/7fitWebOS/js/views-system.js
timestamp: 2026-09-25T15-59-58Z
slug: js-views-system-js
---
Method: dual-agent (A: warmup_design_review · B: warmup_detector_evidence)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | 摘要展示当前模式、L/P 窗口和结果数量，但不解释单条排序原因。 |
| 2 | Match System / Real World | 2/4 | 教练要同时理解 Session L、动作 T、热身 P 与 Anatomy。 |
| 3 | User Control and Freedom | 3/4 | 原生下拉和详情页可用；详情返回链接会丢失当前筛选。 |
| 4 | Consistency and Standards | 3/4 | 页面规则清晰，但数据里的 sessionLevels 与 P 窗口有冲突。 |
| 5 | Error Prevention | 3/4 | 合法等级由规则过滤；多份兼容字段可能在降级路径产生不同结果。 |
| 6 | Recognition Rather Than Recall | 2/4 | L/T/P 作用虽有说明，仍需用户在页面不同区域来回对照。 |
| 7 | Flexibility and Efficiency | 2/4 | 可调整模式、L、T；没有常用组合，结果仍需逐卡比较。 |
| 8 | Aesthetic and Minimalist Design | 2/4 | 三组筛选、两类结果和等级卡片并置，辅助文字也偏小。 |
| 9 | Error Recovery | 2/4 | 无匹配提示没有给出明确的下一步调整建议。 |
| 10 | Help and Documentation | 2/4 | 动作详情有用；术语释义与核心决策提示分散。 |
| **Total** |  | **24/40** | **Acceptable：核心逻辑有基础，规则理解和结果选择仍费力。** |

## Design Specificity Verdict

页面内容明显针对 7Fit：把动作模式、课程等级 L、动作层级 T、热身等级 P、解剖匹配和泡沫轴建议放进同一套规则。信息模型具有产品特异性；页面视觉则主要使用通用的训练后台卡片和紫色强调，尚未形成同样鲜明的产品表达。匹配器主体见 [views-system.js:217](/Users/ronny/program/7fitWebOS/js/views-system.js:217)，样式规则见 [app.css:502](/Users/ronny/program/7fitWebOS/assets/app.css:502)。

**Deterministic scan:** CLI 对目标 js/views-system.js 返回 0 findings（exit 0，结果 []）。浏览器检测层在实际页面 DOM 中报告 87 个 anti-pattern 命中，包括白字与 #9566f2 的对比度为 3.8:1、11–11.5px 正文、10–10.5px 功能文字及 kicker 标签。87 是 DOM 命中数，不等于 87 个独立设计缺陷；小号标签有些可能是有意的视觉层级，但规则说明和处方文字需要优先保证可读性。

**Visual overlay:** 检测脚本注入成功；标有 [Human] 的 Chrome 标签页中可查看覆盖层。没有保存单独截图文件。

## Overall Impression

热身分级的核心判断有清楚骨架：L 决定允许的 P 窗口，T 提供匹配上下文。主要风险在“规则事实由谁说了算”和“推荐候选是否等于执行顺序”这两个边界。把这两个边界解释清楚，比继续增加热身动作更能提升教练对系统的信任。

## What's Working

- 页面明确分开 L 准入和 T 匹配上下文；P 等级按本级优先、逐级向下兼容。[views-system.js:217](/Users/ronny/program/7fitWebOS/js/views-system.js:217) [prep-grade.js:4](/Users/ronny/program/7fitWebOS/js/prep-grade.js:4)
- 动作卡直接展示剂量，详情补充安排理由、教练口令、等级说明和动作库记录；泡沫轴详情还包含安全边界。[views-system.js:159](/Users/ronny/program/7fitWebOS/js/views-system.js:159) [views-system.js:174](/Users/ronny/program/7fitWebOS/js/views-system.js:174)
- 筛选值写入 URL，便于复制或通过地址恢复匹配条件；控件绑定见 [views-system.js:311](/Users/ronny/program/7fitWebOS/js/views-system.js:311)。

## Cognitive Load

按 Impeccable 清单，失败 5/8，属高负荷：

- **未通过：**单一焦点、内容分块、一次一个决策、≤4 个可见选项、减少工作记忆负担。
- **通过：**泡沫轴/动态热身/等级规则有分区；结构有标题与卡片层次；动作详情采用渐进披露。

主要原因是用户要同时选 8 个动作模式之一、4 个 L、4 个 T，再比较泡沫轴与最多 12 条动态热身候选；三套等级的语义需要在摘要和下方说明之间来回对照。[views-system.js:186](/Users/ronny/program/7fitWebOS/js/views-system.js:186) [views-system.js:199](/Users/ronny/program/7fitWebOS/js/views-system.js:199)

## Emotional Journey

开头出现 L/T/P 和 Anatomy 等术语，首次使用者容易先停下来理解规则；选完后摘要与动作卡给出具体结果，能建立一些信心；进入详情后，剂量、口令和理由有助于教练判断。流程收尾较弱：系统没有解释为什么某条排在前面，也没有清楚标出“这只是候选推荐”或“课程热身已编排完成”。

## Priority Issues

1. **[P2] L/P 准入兼容规则存在多份冲突来源。**运行规则是 L1→P1、L2→P2/P1、L3→P3/P2/P1、L4→P4/P3/P2/P1；但热身数据的 P2 元数据仍写 L1–L4，P3 写 L2–L4。对照 56 个动作记录，有 11 个 sessionLevels 与 P 等级窗口不一致；例如 PREP-03 的 P3 数据仍列 L2–L4。当前页面在 prep-grade.js 已加载时按窗口过滤，所以页面当下的主规则一致；但数据保留了会在 fallback 分支使用的旧字段，维护者可能得到不同答案。[prep-grade.js:4](/Users/ronny/program/7fitWebOS/js/prep-grade.js:4) [prep.json:143](/Users/ronny/program/7fitWebOS/data/src/prep.json:143) [prep.json:2158](/Users/ronny/program/7fitWebOS/data/src/prep.json:2158) [views-system.js:203](/Users/ronny/program/7fitWebOS/js/views-system.js:203)
   **修复：**指定 P 窗口为唯一权威来源；从它派生页面兼容文案，或校验并同步旧 sessionLevels。建议命令：$impeccable clarify。

2. **[P2] 候选匹配列表没有明确说明它不是执行顺序。**系统页按 P 等级、解剖和动作模式展示候选；课程编排器则按五个功能槽、器械路由、动作资格、去重和 sequencePhase 组织热身。[views-system.js:199](/Users/ronny/program/7fitWebOS/js/views-system.js:199) [prep-resolver.js:356](/Users/ronny/program/7fitWebOS/js/prep-resolver.js:356) [coach/prep.js:134](/Users/ronny/program/7fitWebOS/js/coach/prep.js:134) 页面没有把“匹配优先级”与“执行顺序”分开标记，教练可能把候选排序当成完整处方。
   **修复：**明确标注“候选匹配排序”，并链接到实际编课槽位；若该页也承担教学用途，再展示地面到站立、简单到复杂的阶段标签。建议命令：$impeccable shape。

3. **[P2] 页面上的小字号与低对比度会拖慢现场扫读。**浏览器检测指出正文常见 11–11.5px、功能文字 10–10.5px，并报告紫底白字对比度 3.8:1。此页本身信息量大，处方和条件说明若与标签一样细小，会让教练更难快速比较卡片。
   **修复：**优先放大并提高处方、匹配条件和操作说明的对比度；保留 eyebrow 和短标签的小字号层级。建议命令：$impeccable typeset。

4. **[P2] 点开动作详情后，页面内“返回”会重置筛选。**详情卡链接包含 focus，但详情页返回地址固定为 #/system/prep，没有带回原来的 pattern、level、tier。[views-system.js:164](/Users/ronny/program/7fitWebOS/js/views-system.js:164) [views-system.js:209](/Users/ronny/program/7fitWebOS/js/views-system.js:209) 教练查看动作后要重新选择筛选条件。
   **修复：**把当前筛选参数带入详情返回地址，或提供显眼且保留状态的返回路径。建议命令：$impeccable harden。

## Persona Red Flags

- **Jordan（首次使用者）：**要先拆解 Session L、动作 T、PREP P 和 Anatomy，再判断哪些条件影响准入、哪些只影响排序。
- **Casey（移动端分心用户）：**小字号处方和多组长列表不利于单手、快速扫读；本轮检测发现文字尺度问题，但没有保存独立移动截图，移动布局结论不做强断言。
- **Alex（熟练教练）：**每套方案都需要设三个条件，且详情返回会丢失筛选；缺少常用模式或快速入口。

## Minor Observations

- PREP 详情直接显示 sourceStatus；例如部分条目写着已有 SUPPORT 节点、建议回写动作库。这类治理备注如果面向日常教练，容易把内部数据维护与训练指导混在一起。[views-system.js:179](/Users/ronny/program/7fitWebOS/js/views-system.js:179) [prep.json:97](/Users/ronny/program/7fitWebOS/data/src/prep.json:97)
- V1 文档标题仍写“30 个规范动作”，当前 JSON 有 56 个动作；V1 可能是历史版本，但不宜继续被当作现行目录。[7Fit-PREP-热身体系-V1.md:14](/Users/ronny/program/7fitWebOS/docs/7Fit-PREP-热身体系-V1.md:14) [prep.json:2](/Users/ronny/program/7fitWebOS/data/src/prep.json:2)
- 泡沫轴说明建议按需选 1–3 个部位，但页面卡片是详情链接，没有选择状态；若此页只做参考浏览则合理，若是完整热身编排入口则少了操作闭环。[views-system.js:198](/Users/ronny/program/7fitWebOS/js/views-system.js:198) [views-system.js:225](/Users/ronny/program/7fitWebOS/js/views-system.js:225)
- 无匹配提示只说“暂无”，没有建议用户优先调整模式还是等级。[views-system.js:226](/Users/ronny/program/7fitWebOS/js/views-system.js:226) [views-system.js:228](/Users/ronny/program/7fitWebOS/js/views-system.js:228)

## Questions to Consider

下一步你希望先推进哪组？  
1. 统一 L/P 权威规则并清理冲突字段。  
2. 重新明确候选页与实际编课器的边界及执行顺序。  
3. 先提高文字对比度、处方可读性和筛选返回体验。
