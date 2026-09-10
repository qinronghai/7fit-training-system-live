# Body Data Contract V1｜#33 Design Spec

状态：Approved direction / 待用户最终审核后进入实施计划

Parent Epic：#26  
依赖：#27 Template Registry ✅、#29 ResolvedSession Contract ✅  
被依赖：#34 Body Resolver V1、#35 Body Coach UI、#39 Release Gate

---

## 1｜目标

为 `Body` 模板建立独立、可审计、可验证的数据域，使后续 Body Resolver 不需要复用 F111 的 `lowerMode / upperMode / SUPPORT / CORE` 业务逻辑，也不需要从 Anatomy exposure 或动作中文名推断健美训练量。

V1 必须回答四类问题：

1. 这个动作是否允许进入 Body 模板；
2. 它在不同 Body Family 中可以承担什么 Role；
3. 它对哪些目标肌群计入 Direct Work Sets；
4. 在不同 Session Level 下，组数、次数、RIR、休息与 Optional Slot 如何受到约束。

核心原则：

> Anatomy 描述“动作涉及谁”；Body Data 描述“本节健美训练中，这个动作为什么被选、对谁计入直接工作量、承担什么编排职责”。两者必须分离。

---

## 2｜架构选择

采用 **独立 `body.json` Sidecar 数据域**。

```text
通用 Action 事实
(actions.json)
    │
    ├─ id / name
    ├─ route / status
    ├─ equipment
    ├─ pattern / anatomy identity
    │
    ▼
Body 专属语义
(body.json)
    │
    ├─ Target
    ├─ Family
    ├─ Role
    ├─ Candidate eligibility
    ├─ Prescription profile
    ├─ Direct Work Sets semantics
    ├─ Volume policy
    └─ Conflict thresholds
```

不采用以下方案：

- 不把大量 Body 特有字段直接写进所有 `actions.json` action record；
- 不从 `actionDetails` 的中文处方字符串解析 Body 训练量；
- 不把 Anatomy primary / secondary exposure 直接等价成 Direct Work Sets；
- 不建立第二套 Body Action identity，Body 必须引用现有正式 Action ID。

---

## 3｜Runtime 数据域

新增：

```text
data/src/body.json
```

建议由 `body.json` 独占以下顶层 Runtime keys：

```text
bodyTargetIds
bodyTargetCatalog

bodyRoleIds
bodyRoles

bodyFamilyIds
bodyFamilies

bodyLevelPolicies
bodyPrescriptionProfiles

bodyActionMeta
bodyVolumePolicy
bodyConflictPolicy
```

这些 key 必须接入：

- `data/src/manifest.json`
- `tools/build_system_data.py`
- `data/system-data.js` generated compatibility bundle
- Schema / validator / mutation tests

`body.json` 与 `composer.json` 分域。F111 Composer 数据不得承担 Body 业务语义。

---

## 4｜Body Target Contract

### 4.1 Target 使用稳定 ID

Resolver、Volume、Conflict 逻辑不得直接以中文肌肉名称作为业务主键。

V1 推荐 Target IDs：

```text
quadriceps
hamstrings
glute_max
glute_med
adductors
calves

lats
upper_back
rear_delts
lateral_delts
front_delts
chest
biceps
triceps
```

`bodyTargetCatalog` 为每个 Target 提供：

```text
id
name
region
anatomyAliases
```

示例语义：

```text
upper_back
→ 中文显示：上背
→ Anatomy aliases：中斜方肌、菱形肌、斜方肌中下束等
```

`anatomyAliases` 仅用于 UI 解释、审计和未来辅助匹配；**不能自动决定 Direct Work Sets**。

### 4.2 Target 扩展原则

V1 不追求把所有肌肉拆到极细。只建立 Body 编课真正需要区分的目标层级。

例如：

- 肩部区分 `rear_delts / lateral_delts / front_delts` 有实际编排价值；
- 股四头内部不拆股直肌 / 股外侧肌；
- 胸部 V1 不拆上胸 / 中胸 / 下胸作为独立 volume target，除非后续真实编课需求证明必要。

---

## 5｜Body Role Contract

正式 Role IDs：

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION
OPTIONAL
```

Role 表达动作在一节 Body Session 中的**编排职责**，不等于 movement pattern，也不等于 Anatomy primary muscle。

定义：

- `PRIMARY`：当日主要刺激目标的核心动作，通常为稳定、可持续进阶的复合或高价值主训练动作；
- `SECONDARY`：补充主要刺激方向，通常改变动作模式、角度或负重路径；
- `ACCESSORY`：补齐目标肌群或训练结构，不承担当日主要负荷；
- `ISOLATION`：局部肌群导向、低全身疲劳的孤立/近孤立动作；
- `OPTIONAL`：在 Level、时间预算或个体需求允许时追加。

Resolver 的具体 Slot 可以是：

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION-1
ISOLATION-2
OPTIONAL
```

其中 `ISOLATION-1 / ISOLATION-2` 是 Session Slot key；它们在 Body 数据语义上都属于 `ISOLATION` Role。

**Role 不得依赖数组位置。**

---

## 6｜Body Family V1

正式 4 个 Family：

### BODY-01｜臀腿｜股四主导

主要目标：

```text
quadriceps
```

协同目标：

```text
glute_max
glute_med
hamstrings
adductors
```

推荐结构：

```text
PRIMARY       膝主导复合
SECONDARY     单腿膝主导 / 第二膝主导
ACCESSORY     臀 / 髋辅助
ISOLATION-1   膝伸类
ISOLATION-2   后侧链平衡
OPTIONAL      臀中 / 内收 / 小腿等低疲劳补充
```

### BODY-02｜臀腿｜臀后侧链

主要目标：

```text
glute_max
hamstrings
```

协同目标：

```text
glute_med
adductors
```

推荐结构：

```text
PRIMARY       髋伸 / 髋铰链主项
SECONDARY     臀推 / 单腿髋伸 / 第二后链方向
ACCESSORY     后链补充
ISOLATION-1   腿弯举
ISOLATION-2   臀部孤立
OPTIONAL      臀中 / 内收
```

### BODY-03｜背肩塑形

主要目标：

```text
lats
upper_back
rear_delts
lateral_delts
```

协同目标：

```text
biceps
```

推荐结构：

```text
PRIMARY       主拉
SECONDARY     第二拉方向
ACCESSORY     肩部塑形
ISOLATION-1   后三角
ISOLATION-2   中束 / 手臂
OPTIONAL      二头 / 肩胛低疲劳补充
```

### BODY-04｜胸肩臂塑形

主要目标：

```text
chest
lateral_delts
triceps
```

协同目标：

```text
front_delts
biceps
```

推荐结构：

```text
PRIMARY       主推
SECONDARY     第二推方向
ACCESSORY     肩部塑形
ISOLATION-1   中束
ISOLATION-2   三头 / 胸部孤立
OPTIONAL      二头或低疲劳补充
```

Family 数据必须显式表达：

```text
familyId
name
primaryTargets
secondaryTargets
slotPolicy
volumeTargets
allowedRoles
```

不能依赖 Family 中文名称字符串推断。

---

## 7｜Body Action Metadata

`bodyActionMeta` 是 Body Resolver 的正式候选事实源。

示例结构：

```json
{
  "hake_shendun": {
    "families": ["BODY-01"],
    "roles": ["PRIMARY", "SECONDARY"],
    "directTargets": ["quadriceps", "glute_max"],
    "secondaryTargets": ["adductors"],
    "exerciseClass": "compound",
    "fatigueCost": "high",
    "stabilityDemand": "low",
    "repProfile": "compound_machine",
    "laterality": "bilateral"
  }
}
```

正式字段：

```text
families
roles
directTargets
secondaryTargets
exerciseClass
fatigueCost
stabilityDemand
repProfile
laterality
```

V1 枚举建议：

```text
exerciseClass:
compound | accessory | isolation

fatigueCost:
low | medium | high

stabilityDemand:
low | medium | high

laterality:
bilateral | unilateral
```

Body eligibility 由 `bodyActionMeta` 中是否存在该 Action ID 决定；V1 不需要再在 `actions.json` 新增 `bodyEligible=true` 形成第二个 truth source。

### 7.1 Candidate whitelist

V1 不给全部 243 个 Action 自动打 Body 标签。

第一版目标：

> 建立约 40–60 个经过人工审计的 Body Candidate 白名单。

优先覆盖：

- 膝主导复合；
- 髋铰链 / 髋伸；
- 单腿动作；
- 水平拉 / 垂直拉；
- 水平推 / 垂直推；
- 腿屈伸 / 腿弯举；
- 臀部孤立；
- 髋外展 / 内收；
- 后三角 / 侧平举；
- 二头 / 三头；
- 必要胸部 / 背部低疲劳辅助。

候选必须引用现有 `actions` 中真实存在的 Action ID。

---

## 8｜Prescription Profile

Body V1 不直接解析现有 `actionDetails['来源处方 / RPE']` 字符串来决定健美处方。

建立 `bodyPrescriptionProfiles`，由动作 `repProfile` 引用。

建议 Profile：

```text
compound_machine
compound_freeweight
single_leg_compound
accessory_compound
isolation_large
isolation_small
```

每个 Profile 可以定义：

```text
repRange
restSecondsRange
allowedRIRRange
```

最终 working sets 由：

```text
Family
+ Level Policy
+ Slot Role
+ Prescription Profile
```

共同决定。

---

## 9｜L1–L4 Body Policy

Body 保留平台统一 Session Level `L1–L4`，但 **不复制 F111 T1–T4**。

Level 主要控制：

- 总 Working Sets；
- 稳定性要求；
- Rep range 边界；
- RIR；
- Rest / density；
- Optional Slot 是否默认开启。

建议 V1 默认区间：

| Level | Session Working Sets | RIR | Optional | 主要目标 |
|---|---:|---:|---|---|
| L1 | 10–12 | 3–4 | 关闭 | 学动作、建立刺激感、低疲劳 |
| L2 | 12–14 | 2–3 | 默认关闭 | 稳定负重、建立基础容量 |
| L3 | 14–16 | 约 2 | 可开启 | 完整塑形训练量 |
| L4 | 16–18 | 1–2 | 默认开启 | 更高训练量 / 密度与独立执行 |

这些是 Resolver 的**目标窗口**，不是要求每节课机械达到上限。

正式原则：

> `L4 ≠ 最复杂动作`。

稳定器械、哈克深蹲、胸托划船、器械臀推等都可以继续存在于 L4，只要它们符合目标、容量和进阶需要。

Level Policy 必须是机器可读数据，不能仅存在文档中。

---

## 10｜Direct Work Sets Contract

### 10.1 定义

Direct Work Sets 是 Body 模板独立的训练量指标。

它只统计：

> 按 Body policy 明确定义为对目标肌群构成“直接工作”的正式 working sets。

不统计：

- 热身组；
- ramp-up / 递增准备组；
- PREP；
- Foam；
- secondary exposure。

### 10.2 基本算法

若一个动作：

```text
workingSets = 3
directTargets = [quadriceps, glute_max]
```

则：

```text
quadriceps += 3 direct sets
glute_max += 3 direct sets
```

若：

```text
secondaryTargets = [adductors]
```

则只增加 secondary exposure 记录，不转换成 direct sets。

### 10.3 不做 fractional pseudo-precision

V1 禁止：

```text
secondary muscle = 0.5 effective sets
stabilizer = 0.25 effective sets
```

这种模型会产生没有足够依据的伪精确。

如果未来要建立 weighted effective-volume 模型，应当作为独立版本设计，而不是偷偷混入 V1。

### 10.4 Unilateral 组数

正式口径：

> `3 sets / side` 在 Direct Work Sets 中记为 **3 sets**，不是 6 sets。

左右侧各自完成 3 个工作组；Body Session 对目标肌群的 volume 不因双侧分别执行而机械翻倍。

此规则必须有 CI 单测。

---

## 11｜Body Volume Policy

`bodyVolumePolicy` 至少定义：

```text
sessionWorkingSetRangesByLevel
directSetTargetRangesByFamily
maxHighFatigueCompounds
isolationRatioRanges
optionalSlotPolicy
```

V1 的作用是给 #34 Resolver 和 Body Conflict Plugin 提供可审计阈值，而不是宣称这些数字是普遍医学/训练学真理。

阈值需要作为 7Fit 当前 Body 模板的门店训练政策维护。

---

## 12｜Body Conflict Policy Data

`bodyConflictPolicy` 只保存**数据阈值与 policy 参数**；算法在 #34 / Body Conflict Plugin 实现。

至少为未来检查提供：

- target coverage；
- direct-set volume；
- high-fatigue compound stacking；
- movement redundancy；
- isolation ratio；
- family deviation；
- time budget。

#33 不实现 Conflict 算法。

---

## 13｜ResolvedSession 边界

#33 **不修改** `ResolvedSession v1`。

但必须为 #34 记录一个明确的后续要求：当前 `SLOT` item 只有 action/prescription/source 等公共字段，且 Schema 使用 `additionalProperties:false`，没有正式承载 Body volume 的位置。

#34 实现时，优先采用向后兼容扩展：

```text
main.metrics.body
```

建议未来表达：

```text
totalWorkingSets
directSetsByTarget
secondaryExposureByTarget
isolationRatio
estimatedMinutes
slotMetrics
```

F111 可以不提供该字段。

#33 只冻结这一方向，不在本 Issue 修改公共 Contract。

---

## 14｜Schema / Validation

新增：

```text
schemas/v14.8/body.schema.json
```

Schema / validator 至少必须拒绝：

- unknown Family ID；
- unknown Role；
- unknown Target；
- unknown Action ref；
- Body Action 没有 `families`；
- Body Action 没有 `roles`；
- Body Action 没有 `directTargets`；
- 非法 fatigue/stability/laterality/repProfile；
- 4 Family 缺失；
- L1–L4 policy 不完整；
- Role/Target ID 重复；
- Direct Work Set 所需 metadata 不完整。

Builder 必须继续保持 strict ownership：新增 `body.json` 后，同时修改正式 ordered source list、manifest owners 与 topLevelOrder，不能采用 last-write-wins。

---

## 15｜CI / Test Contract

#33 至少需要以下测试：

### 数据 Schema

- body schema positive；
- invalid role rejection；
- invalid family rejection；
- invalid target rejection；
- unknown action ref rejection；
- missing direct-set metadata rejection。

### Family coverage

- 正好存在 BODY-01～BODY-04；
- 每个 Family 有 primary/secondary targets；
- 每个 Family 的必需 Role 至少有合法 candidate；
- 每个 Level policy 完整。

### Candidate coverage

- Body whitelist 中每个 Action 在 `actions.json` 存在；
- 每个候选至少有一个 Family / Role / directTarget；
- 所有 direct/secondary target 都存在于 target catalog。

### Volume semantics

- bilateral direct sets；
- unilateral `3 sets/side → 3 direct sets`；
- secondary exposure 不增加 direct sets；
- ramp-up exclusion contract。

### Build / runtime

- manifest ownership；
- generated `system-data.js` freshness；
- runtime bundle 包含完整 Body keys；
- F111 existing data/tests 不回归。

---

## 16｜实施边界

#33 做：

- `body.json`；
- Body target / family / role / level / prescription / action metadata；
- Body volume/conflict policy 数据；
- manifest/build/schema/validator/tests；
- 首批 Body Action whitelist 审计。

#33 不做：

- Body Resolver；
- Body Coach UI；
- Copy；
- Save/Restore；
- Body Conflict 算法；
- Body PREP UI；
- 高级健美技术（Drop Set、Rest-Pause、Myo-Reps、超级组）；
- 把 Anatomy exposure 换算为“有效组”；
- 为全部 Action 自动生成 Body metadata。

---

## 17｜#34 的正式输入输出边界

#33 完成后，#34 Body Resolver 的数据流必须是：

```text
Body Family
    ↓
Body Level Policy
    ↓
Body Slot / Role Contract
    ↓
bodyActionMeta candidate pool
    ↓
Family × Level × Role × route legality
    ↓
Body Prescription Profile
    ↓
Direct Work Sets
    ↓
Body Conflict Plugin
    ↓
ResolvedSession(main.kind = SLOT)
```

#34 不允许再回头从中文名、F111 Composer 或 Anatomy primary/secondary 字段推断 Body 业务规则。

---

## 18｜成功标准

当 #33 完成时，应满足：

1. Body 拥有独立 Source of Truth；
2. 4 Family 与 L1–L4 机器可读；
3. 第一批 Body 候选动作全部经过人工审计；
4. Resolver 可以仅依赖 Body Contract + 通用 Action facts 工作；
5. Direct Work Sets 与 Anatomy exposure 已明确分离；
6. 单侧、ramp-up、secondary exposure 的 volume 口径不会产生歧义；
7. CI 可以阻止非法 Family / Role / Target / Action / metadata 进入 master；
8. 不改变 F111 已上线行为。

达到以上条件后，#34 才允许开始实现 Body Resolver V1。
