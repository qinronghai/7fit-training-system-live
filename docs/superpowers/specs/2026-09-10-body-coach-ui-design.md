# Body Coach UI / Workflow Design

**Issue:** #35 — Body Coach Composer 与 PREP / Anatomy / Copy / State 接入

**Status:** Approved approach A — Body 独立领域 View + 轻量共享 UI Adapter 层

## 1. Goal

将 #34 已完成的 Body Resolver V1 落到教练可操作的 Coach Workflow 中，并保持所有训练规则继续由 `V15BodyResolver` / `ResolvedSession` 提供。

#35 负责页面、交互与共享服务接入，不重新定义 Body 训练规则。

交付后应具备：

- `#/coach/body` Body 首页；
- 4 个 Body Family × L1–L4 共 16 个 Session 可进入；
- `#/coach/body/compose` 自由编课入口；
- Slot 合法候选替换与恢复默认；
- Multi-template State 持久化；
- PREP V2；
- Anatomy；
- Direct Work Sets；
- Body Conflict；
- Coach Copy / Member Copy；
- 390px 手机端完整可用。

## 2. Non-goals

本 Issue 明确不做：

- 不修改 #34 Body Resolver 的 Family、candidate ranking、volume、prescription、conflict 规则；
- 不修改 #33 Body Data Contract；
- 不把 F111 Session / Composer 重写成全新系统；
- 不实现 Conditioning UI；
- 不实现 Save / Restore 历史课程；
- 不实现周训练量历史图表；
- 不实现 Body Recovery 自动编排算法；
- 不在 UI 中重新计算 Direct Work Sets、Conflict 或 Anatomy；
- 不把 F111 lower/upper/support/core 语言套到 Body。

## 3. Frozen compatibility gates

实现期间必须保持：

- `ResolvedSession.schemaVersion === 1`；
- `conflictContext.status` 仍为 `PASS | WARN | FAIL`；
- Body Resolver 16-state frozen baseline 不变：
  `c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005`；
- F111 Conflict frozen baseline 不变：
  `af7d84bc1a1c34793cd81ea776690dfb450f3d13ea1a926be33abda590358465`；
- F111 现有 canonical URL、Copy、PREP、swap 与 browser behavior 不回归；
- `js/state.js` 只在证明存在通用平台缺口时才允许修改，Body-specific behavior 不进入 State Core。

## 4. Why Approach A

当前平台底层已经多模板化，但 Coach UI 仍有 F111 绑定：

- Router 只有 F111 正式 Session route；
- `views-coach.js` 的 bind 逻辑直接写 F111 State facade；
- `Session` / `ComposerView` / `Prep` 都使用 F111 的页面与领域语义。

直接复制 F111 页面会产生第二套硬编码，并在 Conditioning 接入时形成第三套重复实现；一次性彻底重写 F111 又会把已冻结行为重新置于风险中。

因此 #35 采用渐进式 Adapter：

```text
Router
  |
  v
Coach View Dispatcher
  |
  +-- legacy F111 modules (unchanged behavior)
  |
  +-- Template UI Registry
          |
          +-- Body UI Adapter
                  |
                  +-- Body Home
                  +-- Body Session / Composer
                  +-- Body PREP Adapter
                  +-- Body Copy Adapter
                  +-- shared Anatomy / Conflict / clipboard services
```

共享的是路由外壳、UI dispatch、PREP Engine、Anatomy、Conflict View、clipboard service 和 V15 State；Body 领域语言、Session 组织、Volume 与 Copy 语义保持独立。

## 5. Route contract

### 5.1 Existing routes that must remain unchanged

```text
#/coach/f111
#/coach/f111/compose
#/coach/f111/f111-06/l3
#/coach/f111-06/l3          legacy alias -> canonical F111 URL
```

### 5.2 Body routes

Body 首页：

```text
#/coach/body
```

Body 正式 Session：

```text
#/coach/body/body-01/l1
#/coach/body/body-02/l3
...
#/coach/body/body-04/l4
```

Router parse result:

```js
{
  area: 'coach',
  page: 'template-session',
  templateId: 'body',
  familyId: 'BODY-02',
  level: 'L3',
  query: {}
}
```

Body Composer：

```text
#/coach/body/compose?family=BODY-02&level=L3
```

Composer 缺省为：

```text
family = BODY-01
level = L1
```

`canonicalHash()` 必须稳定输出上述形式。

### 5.3 Route legality

- Body Family 只接受 `V14_DATA.bodyFamilyIds` 中的值；
- Level 只接受 `L1..L4`；
- Conditioning 仍只有 landing / compose placeholder，不能因为 Router 泛化而提前开放 Conditioning Session；
- Posture 仍保持 FUTURE；
- unknown template / family / level 必须保持 invalid route。

## 6. Template UI Registry

新增轻量共享 registry，例如：

```js
window.V14CoachModules.TemplateUI.register(templateId, adapter)
window.V14CoachModules.TemplateUI.get(templateId)
```

Adapter contract：

```js
{
  canHandle(route) -> boolean,
  render(route) -> html,
  bind(route, root, rerender) -> void
}
```

规则：

- registry 不包含训练业务规则；
- `views-coach.js` 优先将非 F111 active template route 委托给 adapter；
- F111 继续走现有 `F111Home / Session / ComposerView`，避免无关重写；
- 未注册 adapter 的 ACTIVE template 继续使用当前 `TemplateHome` generic landing；
- FUTURE template 不允许进入编辑流程。

## 7. Body Home

`BodyHome.render()` 使用 `bodyFamilyIds / bodyFamilies / bodyTargetCatalog`，展示四张 Family 卡：

- BODY-01｜臀腿｜股四主导；
- BODY-02｜臀腿｜臀后侧链；
- BODY-03｜背肩塑形；
- BODY-04｜胸肩臂塑形。

每张卡展示：

- Family 名称；
- 主要目标肌群；
- 辅助目标肌群；
- 简短 UI 说明；
- L1 / L2 / L3 / L4 入口。

Body 首页顶部提供：

```text
推荐 Family / Level
自由编课
```

Family 的 UI 说明允许是 presentation copy，但不得参与 candidate legality、volume 或 conflict 计算。

## 8. Body Session / Composer shared model

Body 正式 Session 与 Body Composer 共享同一个 Session editor，不实现两套 slot 逻辑。

区别仅在入口控制：

- Session route 的 `familyId + level` 来自 URL path；
- Composer 的 `familyId + level` 来自 query selector，可即时切换。

核心 resolve pipeline：

```text
route family + level
    |
    v
ensure / reconcile Body V15 State
    |
    v
V15TemplateResolver.resolve('body', {
  familyId,
  level,
  selections: persisted manual intent
})
    |
    v
ResolvedSession
    |
    +-- main.content            -> Slot UI
    +-- prepContext             -> PREP Adapter
    +-- anatomyContext          -> Anatomy UI
    +-- conflictContext         -> shared ConflictView
    +-- domainContext.volume    -> Body Volume UI
    +-- copy payload            -> Body Copy Adapter
```

UI 不允许自行重算这些派生数据。

## 9. Body State adapter

Body session key 固定为：

```text
BODY-01-L1
BODY-02-L3
...
```

State metadata：

```js
{
  familyId: 'BODY-02',
  level: 'L3',
  resolverVersion: 'body-v1',
  input: {familyId: 'BODY-02', level: 'L3'}
}
```

进入 Session 时：

1. `V15State.ensureSession('body', sessionKey, metadata)`；
2. 若 resolverVersion 变化，使用 `reconcileSession`；
3. 对已有 formal selections 调用 `V15BodyResolver.isSelectionValid({familyId, level, slotKey, actionId})`；
4. stale manual selection 被删除；
5. 用清理后的 State resolve Body Session。

### 9.1 Swap

Slot 下拉候选只来自：

```js
V15BodyResolver.candidates({
  familyId,
  level,
  slotKey,
  currentSelections
})
```

选择后：

```js
V15State.setSelection('body', sessionKey, slotKey, actionId, 'manual')
```

然后重新执行完整 resolve + render。

### 9.2 Reset

“恢复系统推荐”执行：

```js
V15State.resetSession('body', sessionKey)
```

这会同时清除当前 Body Session 的 formal manual intent 与 PREP manual intent，然后重新建立 auto baseline。

## 10. Body Slot UI

Body Slot 顺序完全读取 `ResolvedSession.main.content`：

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION-1
ISOLATION-2
OPTIONAL (L3/L4)
```

每张卡至少显示：

- 人类可读 Role：主项 / 次主项 / 辅助 / 孤立 / 可选补充；
- 动作名称；
- Sets × Reps；
- RIR；
- Rest；
- 当前 source：系统推荐 / 手动选择；
- 查看动作；
- 合法候选下拉。

UI 可以读取 `domainContext.slots[slotKey]` 展示 structured prescription，但不得基于字符串反解析 volume。

## 11. Anatomy vs Direct Work Sets

这是 #35 的关键语义边界。

### Anatomy

读取：

```js
resolvedSession.anatomyContext
```

标题固定强调：

```text
ANATOMY｜动作涉及肌群
```

说明：

```text
表示本节动作中的主要 / 协同 / 稳定参与，不等同于有效工作组数。
```

### Direct Work Sets

读取：

```js
resolvedSession.domainContext.volume
```

至少展示：

- totalWorkingSets；
- estimatedMinutes；
- directSetsByTarget；
- isolationWorkingSets / isolationRatio；
- highFatigueCompoundCount。

Direct target 名称通过 `bodyTargetCatalog` 转成人类可读中文。

可增加一行：

```text
协同暴露：secondaryExposureByTarget（不计入 Direct Work Sets）
```

禁止把 Anatomy exposure 转换成 sets，也禁止把 secondary exposure 1:1 计入 direct sets。

## 12. Body Conflict UI

直接复用：

```js
V14CoachModules.ConflictView.render(resolvedSession.conflictContext)
```

Body View 不解释或重新判断 `BODY_*` 规则。

页面显示：

- PASS / WARN / FAIL；
- hardCount；
- warnCount；
- issue title / text。

内部 `code` 不需要显示给普通 Coach UI。

## 13. Body PREP Adapter

Body 不复制 F111 PREP 算法。

唯一输入使用 #34 已生成的：

```js
resolvedSession.prepContext
```

Resolve：

```js
V14PrepResolver.resolve(resolvedSession.prepContext, {
  selections: V15State.getPrepSelections('body', sessionKey)
})
```

UI 固定复用 PREP V2 五功能槽位。

手动 PREP 替换：

```js
V15State.setPrepSelection('body', sessionKey, slotKey, actionId, 'manual')
```

如果已保存的 manual PREP 在新的 Family / Level / formal selections 下失效：

- 删除 stale PREP selection；
- 回退系统推荐；
- 页面显示一次“原热身选择已失效，已恢复系统推荐”提示。

**页面显示与 Copy 必须调用同一个 Body PREP resolve helper。** 不允许 Copy 单独再算一份热身。

## 14. Recovery V1 boundary

#35 需要显示 Recovery，但当前 Body Data Contract / Resolver 没有 Recovery domain model。

为避免反向扩展 #33/#34，#35 采用共享场馆提示层，不做自动化 Recovery 选择：

```text
训练后恢复｜约 5–8 分钟
力量训练结束后进行低强度恢复与呼吸整理；如需拉伸，按当日训练肌群由教练人工选择。
恢复内容不计入 Direct Work Sets。
```

它是 UI / Copy 的固定场馆提示，不参与 Resolver、Conflict、Volume、State。

未来若要实现自动 Recovery Engine，应另开独立 Issue。

## 15. Body Copy Adapter

Body Copy 不直接复用当前 F111 `formatCoach / formatMember` 的领域格式，因为现有 formatter 带有 F111 的 2F PREP / 1F STRENGTH、lower/upper/core 主题推断。

新增 Body-specific formatter，但复用共享 clipboard：

```js
V14SessionCopy.copyText(text)
V14SessionCopy.formatDate(now)
```

### 15.1 Single source payload

Body 页面先构造一个 payload：

```js
{
  templateId: 'body',
  familyId,
  familyName,
  level,
  summary,
  prep,
  slots,
  anatomy,
  volume,
  conflicts,
  recovery
}
```

其中：

- slots 来自 `ResolvedSession.main.content + domainContext.slots`；
- prep 来自与页面同一个 Body PREP resolve helper；
- anatomy 来自 `anatomyContext`；
- volume 来自 `domainContext.volume`；
- conflicts 来自 `conflictContext`。

### 15.2 Coach Copy

Coach 版至少包含：

- 日期；
- Family / Level；
- 今日训练重点 / 主要目标肌群；
- PREP；
- 每个 Slot 的人类可读 Role + 动作 + Sets/Reps/RIR/Rest；
- Direct Work Sets；
- Anatomy；
- 系统提醒；
- Recovery。

每个动作的 Cue / Observation 从既有动作库读取：

```js
V14_DATA.actionDetails[actionId]?.fields?.['教练口令']
V14_DATA.actionDetails[actionId]?.fields?.['常见错误']
```

对 canon action 可兼容：

```js
['常见代偿']
```

仅在字段存在时输出，不为缺失动作编造内容。

### 15.3 Member Copy

Member 版使用会员语言，只表达：

- 日期；
- 今天练什么；
- 训练部位 / 训练重点；
- PREP 的人类可读名称；
- 动作名称 + 简化处方；
- 阶段说明；
- Recovery。

Member Copy 必须通过 anti-leak gate，禁止出现：

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION
OPTIONAL
BODY_*
resolverVersion
schemaVersion
conflictContext
domainContext
Direct Work Sets 的内部 target id
```

可以使用“主项 / 次主项 / 辅助”等自然语言解释，但默认 Member Copy 不展示内部 Role 层级。

## 16. Body Composer UX

Body Composer 不复制 F111 5 × 4 主模式矩阵。

顶部只有两个主要决策：

1. 选择 Family；
2. 选择 Level。

然后进入与 Session 页面相同的完整 Body editor。

Desktop：Family cards / segmented control + L1–L4。

390px：Family `<select>` + Level 横向按钮或可换行按钮，不使用需要横向滚动的大矩阵。

Composer family / level 改变时使用 URL query 作为 route intent；每个正式 `BODY-xx-Ln` 的 manual state 独立保存，不把 selections 塞进 query。

## 17. Mobile rules

390 × 844 为硬验收尺寸。

必须满足：

- `document.documentElement.scrollWidth === clientWidth`；
- pageerror = 0；
- Family selector、Level selector、slot dropdown、Copy 按钮均可点击；
- Slot 卡单列；
- Direct Work Sets target rows 可换行，不做宽表格；
- PREP 五卡单列或自适应；
- Copy toolbar 在窄屏允许换行；
- 无必须横向滚动才能操作的控件。

## 18. Error handling

### Invalid route

返回现有 empty-state 风格，并提供 `#/coach/body` 返回入口。

### No eligible candidate

正常 #34 baseline 不应发生。若 Resolver 抛 `BODY_NO_ELIGIBLE_CANDIDATE`，UI 捕获后显示明确错误卡，不吞异常伪装成空动作。

### Stale State

使用 reconcile / fallback，保留可用 manual intent，删除非法项。

### Copy unavailable

沿用现有复制状态提示：

```text
已复制，可直接发送
复制失败，请手动选择内容复制
```

## 19. File ownership

建议新增：

```text
js/coach/template-ui.js       shared adapter registry only
js/coach/body-home.js         Body landing
js/coach/body-session.js      Body route model + editor render/bind orchestration
js/coach/body-prep.js         Body PREP State/resolve/render helper
js/coach/body-volume-view.js  Direct Work Sets presentation only
js/coach/body-copy.js         Body payload + Coach/Member formatter
```

建议修改：

```text
js/router.js                  Body template-session contract
js/views-coach.js             delegate Body routes to Template UI Registry
js/coach/common.js            only additive shared presentation helpers if required
index.html                    load new modules in dependency order
assets/app.css                Body UI + 390px rules
```

原则：

- 不把 Body 规则塞进 `views-coach.js`；
- 不把 Body Copy 塞进 F111 formatter；
- 不把 Direct Work Sets 计算塞进 view；
- 不把 Body-specific reconciliation 塞进 State Core。

## 20. Test design

### Runtime / contract tests

至少覆盖：

1. Router：
   - 16 个 Body Session route valid；
   - Body compose canonical；
   - F111 route parity；
   - Conditioning 不提前开放 Session。

2. Body Home：
   - 4 Family；
   - 每个 Family 有 L1–L4；
   - compose entry。

3. Body Session：
   - BODY-01..04 × L1..L4 均 render；
   - L1/L2 5 slots；L3/L4 6 slots；
   - role/prescription/volume/anatomy/conflict 均来自 resolved session。

4. Swap / State：
   - legal swap -> `source:'manual'`；
   - rerender / reload 后保留；
   - reset -> auto baseline；
   - stale selection safe fallback。

5. PREP：
   - Body 页面与 Copy 使用同一 resolved selections；
   - manual PREP persistence；
   - formal swap 后 stale PREP fallback。

6. Volume refresh：
   - swap 后 UI 的 Direct Work Sets 与重新 resolve 的 `domainContext.volume` deep-equal；
   - UI 不解析 prescription 计算 sets。

7. Conflict refresh：
   - swap 后页面 status/issues 与 `ResolvedSession.conflictContext` 一致。

8. Copy：
   - Coach 包含 role/prescription/targets/volume/cue/observation；
   - Member anti-leak；
   - F111 Copy tests 完整继续通过。

### Browser release scenario

主场景固定：

```text
390 × 844
#/coach/body/compose?family=BODY-02&level=L3
```

执行：

1. 页面加载，确认 BODY-02 / L3；
2. 6 个 Body Slots 可见；
3. Direct Work Sets 与 Anatomy 分区均可见；
4. 找一个至少有 2 个候选的 Slot 并替换；
5. 确认下拉仍为 manual target；
6. 确认 Volume / Anatomy / Conflict 重新渲染；
7. 替换一个 PREP slot；
8. reload；
9. formal + PREP manual selections 均保留；
10. 点击 Coach Copy；
11. 点击 Member Copy；
12. Member text 无内部字段泄漏；
13. 点击恢复系统推荐；
14. formal + PREP 回到 auto；
15. `pageerror = 0`；
16. 无横向溢出。

## 21. Release gate

合并前：

- full pytest；
- build freshness；
- V14.8 schema validation；
- all Node runtime tests；
- JS syntax；
- full Playwright；
- Body frozen resolver SHA unchanged；
- F111 frozen conflict SHA unchanged；
- final diff audit 无 Body data/resolver rule drift。

PR 使用 exact head SHA gate。

Merge 后在 `master` 上再次要求：

```text
verify -> success
browser-smoke -> success
deploy -> success
```

只有同一 merge SHA 三个 gate 全绿后 #35 才算 release-complete。
