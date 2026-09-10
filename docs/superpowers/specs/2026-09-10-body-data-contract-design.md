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
2. 它在不同 Body Family / Level 中可以承担什么 Role；
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

由 `body.json` 独占以下顶层 Runtime keys：

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

V1 Target IDs：

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

`anatomyAliases` 仅用于 UI 解释、审计和未来辅助匹配；**不能自动决定 Direct Work Sets**。

### 4.2 Target 扩展原则

V1 只建立 Body 编课真正需要区分的目标层级：肩部保留前/中/后三角区分；股四头内部不细分；胸部 V1 不拆上胸/中胸/下胸独立 volume target。后续只有真实编课需求证明必要时才扩展。

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

Role 表达动作在一节 Body Session 中的编排职责，不等于 movement pattern，也不等于 Anatomy primary muscle。

- `PRIMARY`：当日主要刺激目标的核心动作，通常为稳定、可持续进阶的复合或高价值主训练动作；
- `SECONDARY`：补充主要刺激方向，通常改变动作模式、角度或负重路径；
- `ACCESSORY`：补齐目标肌群或训练结构，不承担当日主要负荷；
- `ISOLATION`：局部肌群导向、低全身疲劳的孤立/近孤立动作；
- `OPTIONAL`：在 Level、时间预算或个体需求允许时追加。

Resolver 的具体 Session Slot：

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION-1
ISOLATION-2
OPTIONAL
```

`ISOLATION-1 / ISOLATION-2` 均映射到 `ISOLATION` Role。**Role 不得依赖数组位置。**

---

## 6｜Body Family V1

### BODY-01｜臀腿｜股四主导

主要目标：`quadriceps`  
协同目标：`glute_max / glute_med / hamstrings / adductors`

```text
PRIMARY       膝主导复合
SECONDARY     单腿膝主导 / 第二膝主导
ACCESSORY     臀 / 髋辅助
ISOLATION-1   膝伸类
ISOLATION-2   后侧链平衡
OPTIONAL      臀中 / 内收 / 小腿等低疲劳补充
```

### BODY-02｜臀腿｜臀后侧链

主要目标：`glute_max / hamstrings`  
协同目标：`glute_med / adductors`

```text
PRIMARY       髋伸 / 髋铰链主项
SECONDARY     臀推 / 单腿髋伸 / 第二后链方向
ACCESSORY     后链补充
ISOLATION-1   腿弯举
ISOLATION-2   臀部孤立
OPTIONAL      臀中 / 内收
```

### BODY-03｜背肩塑形

主要目标：`lats / upper_back / rear_delts / lateral_delts`  
协同目标：`biceps`

```text
PRIMARY       主拉
SECONDARY     第二拉方向
ACCESSORY     肩部塑形
ISOLATION-1   后三角
ISOLATION-2   中束 / 手臂
OPTIONAL      二头 / 肩胛低疲劳补充
```

### BODY-04｜胸肩臂塑形

主要目标：`chest / lateral_delts / triceps`  
协同目标：`front_delts / biceps`

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

示例：

```json
{
  "hake_shendun": {
    "families": ["BODY-01"],
    "levels": ["L1", "L2", "L3", "L4"],
    "roles": ["PRIMARY", "SECONDARY"],
    "directTargets": ["quadriceps"],
    "secondaryTargets": ["glute_max", "adductors"],
    "exerciseClass": "compound",
    "fatigueCost": "high",
    "stabilityDemand": "low",
    "repProfile": "compound_machine",
    "laterality": "bilateral"
  }
}
```

正式必需字段：

```text
families
levels
roles
directTargets
secondaryTargets
exerciseClass
fatigueCost
stabilityDemand
repProfile
laterality
```

V1 枚举：

```text
exerciseClass: compound | accessory | isolation
fatigueCost: low | medium | high
stabilityDemand: low | medium | high
laterality: bilateral | unilateral
```

### 7.1 Level eligibility

Action 对 Session Level 的合法性必须由 `levels` 显式声明。

#34 不允许根据 `stabilityDemand`、Tier、动作名或器械类型自行推断“L1 能不能用”。`stabilityDemand` 只用于排序、解释和 Conflict policy，不是隐式 Level truth source。

### 7.2 Body eligibility

Body eligibility 由 `bodyActionMeta` 中是否存在该 Action ID 决定；V1 不在 `actions.json` 再增加 `bodyEligible=true`，避免形成双 truth source。

### 7.3 Candidate whitelist

V1 不给全部 243 个 Action 自动打 Body 标签。第一版建立约 **40–60 个经过人工审计的 Body Candidate 白名单**，优先覆盖膝主导、髋铰链/髋伸、单腿、水平/垂直推拉、腿屈伸/腿弯举、臀部孤立、髋外展/内收、后三角/侧平举、二头/三头及必要低疲劳胸背辅助。

候选必须引用现有 `actions` 中真实存在的 Action ID。

### 7.4 Main Role / Family Target Gate

Body V1 冻结以下硬约束：只要 Candidate 的 `roles` 包含 `PRIMARY` 或 `SECONDARY`，其 `directTargets` 必须至少命中该 Candidate 所属**每一个** Family 的 `primaryTargets`。

V1 的 `roles` 是 Candidate 在 `families` 中共享的合法 Role 集，不做按 Family 隐式角色推断。若同一动作在两个 Family 中的主项职责不同，V1 采用保守的 Family membership 拆分；未来只有真实需求证明必要时，才升级为显式 `rolesByFamily` contract。

---

## 8｜Prescription Profile

Body V1 不解析现有 `actionDetails['来源处方 / RPE']` 字符串决定健美处方。

正式 `repProfile`：

```text
compound_machine
compound_freeweight
single_leg_compound
accessory_compound
isolation_large
isolation_small
```

V1 默认 Profile：

| Profile | Rep Range | Rest | 说明 |
|---|---|---|---|
| compound_machine | 8–15 | 90–150s | 稳定器械复合动作 |
| compound_freeweight | 6–12 | 120–180s | 自由负重复合动作 |
| single_leg_compound | 8–12/侧 | 90–150s | 单侧复合动作 |
| accessory_compound | 10–15 | 75–120s | 中低疲劳辅助复合 |
| isolation_large | 10–20 | 60–90s | 大肌群孤立/近孤立 |
| isolation_small | 12–20 | 45–75s | 肩/手臂等小肌群孤立 |

RIR 由 Session Level policy 提供。最终 prescription 由：

```text
Family + Level Policy + Slot Role + Prescription Profile
```

共同决定。

这些数值是 7Fit Body V1 的门店编课 policy，不宣称为普遍训练学唯一标准。

---

## 9｜L1–L4 Body Policy

Body 保留平台统一 `L1–L4`，但不复制 F111 T1–T4。

| Level | Session Working Sets | RIR | Optional | 主要目标 |
|---|---:|---:|---|---|
| L1 | 10–12 | 3–4 | 关闭 | 学动作、建立刺激感、低疲劳 |
| L2 | 12–14 | 2–3 | 默认关闭 | 稳定负重、建立基础容量 |
| L3 | 14–16 | 约 2 | 可开启 | 完整塑形训练量 |
| L4 | 16–18 | 1–2 | 默认开启 | 更高训练量 / 密度与独立执行 |

为避免 #34 自行发明工作组数，V1 冻结默认 Slot working-set skeleton：

| Level | PRIMARY | SECONDARY | ACCESSORY | ISO-1 | ISO-2 | OPTIONAL | 默认总组数 |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1 | 3 | 2 | 2 | 2 | 1 | 0 | 10 |
| L2 | 3 | 3 | 2 | 2 | 2 | 0 | 12 |
| L3 | 3 | 3 | 3 | 2 | 2 | 1 | 14 |
| L4 | 4 | 3 | 3 | 3 | 2 | 1 | 16 |

这些是默认骨架。Resolver 后续可在 `sessionWorkingSetRanges` 内按候选和 time policy 调整，但不能越过 Level 的合法范围。

正式原则：

> `L4 ≠ 最复杂动作`。

稳定器械、哈克深蹲、胸托划船、器械臀推等都可以继续存在于 L4，只要符合目标、容量和进阶需要。

---

## 10｜Direct Work Sets Contract

### 10.1 定义

Direct Work Sets 是 Body 模板独立的训练量指标，只统计 Body policy 明确定义为对目标肌群构成“直接工作”的正式 working sets。

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
directTargets = [glute_max, hamstrings]
```

则：

```text
glute_max += 3 direct sets
hamstrings += 3 direct sets
```

`directSetsByTarget` 是**按目标肌群分别统计的多标签分布**。它不能用于反推 Session 总工作组数。

正式定义：

```text
totalWorkingSets = 每个正式训练 Slot 的 workingSets 只求和一次
```

因此一个 3 组动作即使同时有两个 `directTargets`，Session 总工作组仍只增加 3，不增加 6。

若 `secondaryTargets = [adductors]`，只增加 secondary exposure 记录，不转换成 direct sets。

### 10.3 禁止 fractional pseudo-precision

V1 禁止把 secondary / stabilizer 自动换算为 `0.5 sets / 0.25 sets` 等所谓有效组。未来若建立 weighted effective-volume，必须独立版本设计。

### 10.4 Unilateral 组数

正式口径：

> `3 sets / side` 在 Direct Work Sets 与 Session totalWorkingSets 中均记为 **3 sets**，不是 6 sets。

此规则必须有 CI 单测。

---

## 11｜Body Volume Policy

`bodyVolumePolicy` 至少定义：

```text
sessionWorkingSetRangesByLevel
slotWorkingSetDefaultsByLevel
directSetTargetRangesByFamily
maxHighFatigueCompounds
isolationRatioRanges
optionalSlotPolicy
```

其中：

- `sessionWorkingSetRangesByLevel` 使用第 9 节的 10–12 / 12–14 / 14–16 / 16–18；
- `slotWorkingSetDefaultsByLevel` 使用第 9 节冻结的默认 Slot skeleton；
- `directSetTargetRangesByFamily` 描述 Family target 的合理直接刺激区间，但不与 `totalWorkingSets` 做相加等式；
- 这些阈值属于 7Fit 当前 Body 模板 policy，可版本化维护。

#33 必须把数据结构和首版阈值写成机器可读数据，不能只留文档说明。

---

## 12｜Body Conflict Policy Data

`bodyConflictPolicy` 只保存数据阈值与 policy 参数；算法在 #34 / Body Conflict Plugin 实现。

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

当前 `SLOT` item 只有 action/prescription/source 等公共字段，并使用 `additionalProperties:false`，尚无 Body volume 正式承载位置。

#34 实现时优先采用向后兼容扩展：

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

F111 可以不提供。#33 只冻结这一方向，不在本 Issue 修改公共 Contract。

---

## 14｜Schema / Validation

新增：

```text
schemas/v14.8/body.schema.json
```

Schema / validator 至少拒绝：

- unknown Family / Role / Target / Action ref；
- Body Action 缺失 `families / levels / roles / directTargets`；
- 非法 fatigue/stability/laterality/repProfile；
- 非法 Level；
- 4 Family 缺失；
- L1–L4 policy 不完整；
- Role/Target ID 重复；
- Direct Work Set 所需 metadata 不完整。

Builder 必须继续 strict ownership：新增 `body.json` 后同时修改正式 ordered source list、manifest owners 与 topLevelOrder，不能采用 last-write-wins。

---

## 15｜CI / Test Contract

### 数据 Schema

- body schema positive；
- invalid role / family / target / level rejection；
- unknown action ref rejection；
- missing direct-set metadata rejection。

### Family coverage

- 正好存在 BODY-01～BODY-04；
- 每个 Family 有 primary/secondary targets；
- 每个 Family 的必需 Role 至少有合法 candidate；
- L1–L4 policy 全部完整。

### Candidate coverage

- whitelist 每个 Action 在 `actions.json` 存在；
- 每个候选至少一个 Family / Level / Role / directTarget；
- 所有 direct/secondary target 存在于 target catalog。

### Volume semantics

- bilateral direct sets；
- multi-target action：target direct sets 可同时增加，但 `totalWorkingSets` 只增加一次；
- unilateral `3 sets/side → 3`；
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
- 首批 Body Action whitelist 人工审计。

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

#33 完成后，#34 Body Resolver 数据流必须是：

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

#34 不允许回头从中文名、F111 Composer 或 Anatomy primary/secondary 字段推断 Body 业务规则。

---

## 18｜成功标准

#33 完成时必须满足：

1. Body 拥有独立 Source of Truth；
2. 4 Family 与 L1–L4 机器可读；
3. 第一批 Body 候选全部经过人工审计；
4. Resolver 可以只依赖 Body Contract + 通用 Action facts；
5. Direct Work Sets 与 Anatomy exposure 明确分离；
6. multi-target、单侧、ramp-up、secondary exposure 的 volume 口径无歧义；
7. CI 可阻止非法 Family / Role / Target / Level / Action / metadata 进入 master；
8. 不改变 F111 已上线行为。

达到以上条件后，#34 才允许开始实现 Body Resolver V1。
