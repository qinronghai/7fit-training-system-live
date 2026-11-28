# 「查看课程」教练带课面板实施计划

> 按任务实施和验收。原型确认后启动开发。

**目标**：教练能在一处查看全课信息、逐组记录和临场换动作，课后能还原实际训练过程。

**架构**：复用会员详情「查看课程」、课程快照、动作搜索和 `complete-session`。将面板视图与逐组草稿分开管理。服务端增加可选实练字段，继续使用现有课程完成事务和 revision 校验。

**技术栈**：Vanilla JS、CSS、现有会员 API、Supabase Postgres、Node 测试、Playwright。

**设计**：[教练带课面板](/Users/ronny/program/7fitWebOS/docs/superpowers/specs/2026-11-26-coach-session-panel-design.md)

## 通用约束

- 入口仍为「查看课程」。待训练可记录，已完成和已取消以查看为主。
- 仅展示实际保存或可查证的阶段、处方和会员信息。旧课缺少字段时按环节降级，补查动作详情不覆盖历史快照。
- 计划快照保持原样。草稿、实练、训练历史各有独立含义。课程保存或重试使用同一组请求数据和 revision。
- 沿用 7Fit 样式、原生可访问控件和现有教练鉴权。手机 320px 起校验，桌面保留右侧面板。
- 本轮覆盖会员课程中的热身和主训练录入、恢复和有氧查看、槽位内替换和完成回看。

## 验收重点

1. 确认组后换动作、再换回，较早的组仍属于当时的动作。切换后的首组留空。
2. `0 kg`、空白、仅记完成、计时和单侧次数的语义保持不同。下一组的预填值必须单独确认。
3. 顶部查动作和替换查动作都可返回原位置。动作库能换入现有推荐之外的合格动作，并解释其他命中项为何不可用。
4. 已有汇总历史和新逐组历史都可回看。一节新课中原动作、新动作都能进下次编课参考。
5. 丢失网络响应、revision 冲突或切换账号时，草稿与会员身份保持一致，已经完成的课只产生一份记录。

## 1. 整理课程数据，接入总览与带课视图

**文件**：`js/member/session.js`、`js/member/center.js`、`assets/app.css`、`tests/member_center_browser.spec.js`。

**接口**：`buildSessionPanelModel({ session, items, member, previousItems })` 返回课程标题、状态、教学提示、阶段和按 `item.id` 索引的槽位模型。沿用 `V14MemberSessionUI.open(sessionId, trigger, onChanged)`，由会员中心提供当前资料，已有调用可照常打开。

- [ ] 从 `session.resolvedSessionSnapshot.memberDetails` 读取泡沫轴、热身、恢复、`postCardioPlan`；优先显示结构化数据，兼容 `warmups`、`recovery`、`postCardio` 的既有文本快照。场地优先以已存数据和站点元数据为准。
- [ ] 总览列出课前、主训练、恢复与有氧；主训练和动态热身用 item ID 打开单动作记录。显示计划处方、休息、RIR、节奏和动作要点，仅显示存在的值。通过已完成时间线定位本节之前最近的已完成课程，异步读取其同动作实练，不阻塞当前课程打开。
- [ ] 浏览器验收当前 F111 例课能查全泡沫轴、动态热身、六个主训练槽位、恢复和有氧；旧课程缺字段仍能打开，已取消无录入按钮；保持取消、复制等已有操作。
- [ ] 运行 `npx playwright test tests/member_center_browser.spec.js`，通过后交付总览。

## 2. 建立逐组记录和兼容存储

**文件**：新增 `js/member/session-recording.js`，修改 `index.html`、`js/member/session.js`、`js/member/api.js`、`schemas/member-v1.schema.json`、`supabase/functions/_shared/member-domain.mjs`、`supabase/functions/member-api/service.mjs`、`supabase/functions/member-api/index.ts`。以 `supabase migration new coach_session_execution` 创建迁移。测试放在 `tests/member_execution_test.js`、`tests/member_domain_test.js`、`tests/member_api_test.js` 和 `supabase/tests/member_management_v1_release_gate.sql`。

**接口**：在 `complete-session.items[]` 和课程详情 items 增加可选 `execution`，对应可空的 `training_session_items.execution` JSONB。缺失或 `null` 代表旧格式。新格式用 `{schemaVersion: 1, segments: Segment[]}`，顺序对应实练过程。每段为 `{actionSnapshot, mode, sets, note}`，动作快照沿用既有 `actionSnapshot`；`mode` 为 `reps | perSide | duration`；每组为 `{reps: number|null, durationSeconds: number|null, loadKg: number|null}`。全空的一行代表教练明确点过「仅记完成」，空数组代表没有逐组实练证据。每项最多 100 组，次数 1–300，时长 1–3600 秒，重量 0–2000 kg 且最多两位小数，动作备注最多 2000 字符。

- [ ] 测试精确校验三种计量方式、计数和负重边界、模式与单位一致性及历史旧格式。确认旧客户端的完成请求仍可用，planned snapshot 不能夹带 execution。
- [ ] 新增可空列和结构校验，在现有完成事务写入 execution。保留 `expectedRevision`、幂等重试和 RPC 的 service-only 权限；沿用现有角色和数据访问方式。API 同步回读字段、校验组与动作快照；明确的 execution 空数组不能被补为已实练。
- [ ] 用 `session-recording.js` 实现 `recordSet(slotId, entry)`、`updateSet(slotId, segmentIndex, setIndex, entry)`、`removeSet(slotId, segmentIndex, setIndex)`、`changeAction(slotId, actionSnapshot)` 和 `toPerformedPatches()`。后续确认前的预填不进入 execution；重置或编辑仅影响目标段。
- [ ] 将记录操作接到单动作视图。明确完成的单一动作可为旧读者投影统一重量、次数和组数；变重、变次数或多个动作时，旧版平面字段留空以避免混合描述。逐组回看使用完整 execution。
- [ ] 训练上下文展开带实练组的所有动作快照，按现有规则统计每课去重的动作、模式和肌群。旧课继续沿用原有 `effectiveActionSnapshot` 路径。只有备注的段、未做过的新动作和未确认预填不进入近期训练。
- [ ] SQL 用原动作 `20 kg × 10` 后换新动作 `25 kg × 8` 验证事务落盘、成功重试、过期 revision、anon 无执行权限。单元测试运行 `node --test tests/member_{execution,domain,api}_test.js`，数据库验收在本地 Supabase 运行仓库的 release-gate SQL。

## 3. 接入两个替换入口

**文件**：`js/member/session.js`、`js/member/session-recording.js`、`js/template-search.js`、`tests/member_center_browser.spec.js`、`tests/member-v1-release-gate_browser.spec.js`。

**接口**：`getReplacementOptions(item, session, activeItems, query)` 返回 `{ candidates, catalogResults }`，结果条目带 `{ actionId, canReplace, reason }`。点击确认前以当前选项再次计算可替换性，再调用 `changeAction`。

- [ ] 现有候选沿用 `replacementCandidates`、`prepReplacementCandidates` 的入口，保留同模式、支撑/核心类型和热身家族去重。动作库复用 `V15TemplateSearch` 动作索引，筛掉组课入口，先检索全库，再判断槽位适用性。
- [ ] 依据保存的槽位、动作模式、阶段、等级、器械与可用场地判断可替换性。优先复用 `V14PrepResolver`、`V14Composer` 已有的热身和 F111 route、等级条件；推荐列表仅影响排序。旧快照缺少判断依据时允许浏览并标出原因，原有候选路径仍可用。
- [ ] 列表和动作详情共用确认。替换后保留已确认记录，旧输入存在未确认修改时在确认面板说明清空范围。返回课程恢复槽位、滚动和焦点。切换回原计划动作时继续保留之前所有已做训练。
- [ ] Playwright 验收两条替换路径：一项从候选换，另一项从全库搜到名单外的合格项并换入。命中不匹配项时可看详情、无法换入。验证候选、查询、已记组、原计划快照和新动作的第 1 组输入彼此独立。

## 4. 完成草稿、保存与整体验收

**文件**：新增 `js/member/session-draft.js`，修改 `index.html`、`js/member/session.js`、`js/member/api.js`、`tests/member_center_browser.spec.js`、`tests/member-v1-release-gate_browser.spec.js`。

- [ ] 草稿以会员 ID、课程 ID、revision、当前教练会话作用域保存。仅在授权并取到匹配课程后恢复。复用现有会话生命周期清理草稿，切换或失效的会话不能读出他人的草稿。保留同一课程的已记组、未确认输入、替换、备注和打开位置。
- [ ] 完成确认展示实练组数。存在已修改但未确认的组时，回到该组补记或清空。失败保留已填数据、请求内容和恢复入口。成功后校验状态并清理草稿，历史按实际组顺序/动作显示。
- [ ] 端到端验收使用同一会员从课程入口带课：查看准备和有氧，录入并修改一组，搜索替换一次，断网后重试，核对历史和下次编课所用的动作。补测旧历史、零重量、无网络、双开冲突、切换会员、320px 和桌面键盘操作。
- [ ] 先在本地执行 `python tools/prepare_static_site.py --dest _site --build-id coach-session-panel`，再执行 `npx playwright test tests/member_center_browser.spec.js tests/member-v1-release-gate_browser.spec.js` 以及会员契约和迁移测试。联调验收顺序为迁移、会员 API、静态前端；对接测试环境确认三层均可回读后再安排发布。
