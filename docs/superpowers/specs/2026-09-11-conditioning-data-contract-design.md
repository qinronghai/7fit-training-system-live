# Conditioning Data Contract V1｜#36 Design Spec

状态：Frozen implementation baseline
Parent Epic：#26
依赖：#27 Template Registry ✅、#29 ResolvedSession Contract ✅
前置产品 Gate：#35 Body Coach UI ✅
被依赖：#37 Conditioning Resolver / Protocol Engine、#38 Conditioning Coach UI、#39 Release Gate

## 1｜目标

为 Conditioning 建立独立、可审计、可验证的数据域，使 #37 可以只依赖：

- Conditioning Family / Goal
- L1–L4 Level Policy
- Protocol Policy
- Modality taxonomy
- 明确的 Station candidate metadata
- 场馆路线 / Transition policy
- Conflict thresholds

来生成 `ResolvedSession(main.kind = PROTOCOL)`。

核心原则：

> Action 描述“这是什么动作”；Conditioning Contract 描述“这个动作是否能作为体能 Station、适合哪些 Protocol / Modality / Level，以及其冲击、协调、疲劳和功率语义”。

禁止从动作中文名、F111 slot、Anatomy 肌群或 legacy `pattern` 字符串自动推导 Conditioning 资格。

## 2｜架构

采用独立 Sidecar：

```
通用 Action facts
(actions.json)
  id / name / route / equipment / status / general impact
          │
          ▼
Conditioning domain
(conditioning.json)
  Family / Protocol / Modality / Level
  Station eligibility
  Work metric
  Impact / Coordination / Fatigue / Power
  Transition / Conflict policy
```

Conditioning eligibility 的唯一 truth source 是 `conditioningActionMeta` membership。

不新增 `conditioningEligible=true` 到 `actions.json`，避免双 truth source。

## 3｜Runtime keys

`data/src/conditioning.json` 独占以下 11 个 Runtime keys：

- `conditioningFamilyIds`
- `conditioningFamilies`
- `conditioningProtocolIds`
- `conditioningProtocols`
- `conditioningModalityIds`
- `conditioningModalities`
- `conditioningLevelPolicies`
- `conditioningProtocolPolicies`
- `conditioningActionMeta`
- `conditioningTransitionPolicy`
- `conditioningConflictPolicy`

必须接入 manifest / strict builder / generated `window.V14_DATA` / Draft 2020-12 schema / cross-record validator / runtime tests。

## 4｜Family V1

固定：

- `CON-01`｜基础有氧
- `CON-02`｜间歇体能
- `CON-03`｜混合体能
- `CON-04`｜爆发功率

每个 Family 显式提供：

- `familyId`
- `name`
- `goal`
- `defaultProtocol`
- `allowedProtocols`
- `primaryModalities`
- `optionalModalities`
- `description`

协议矩阵冻结为：

- CON-01：STEADY / INTERVAL；默认 STEADY
- CON-02：INTERVAL / CIRCUIT；默认 INTERVAL
- CON-03：CIRCUIT / DENSITY / INTERVAL；默认 CIRCUIT
- CON-04：INTERVAL / CIRCUIT；默认 INTERVAL

Family 只定义目标与合法结构，不直接持有 Station action IDs。

## 5｜Protocol V1

固定：

- `STEADY`
- `INTERVAL`
- `CIRCUIT`
- `DENSITY`

Protocol record 提供稳定语义：

- `protocolId`
- `name`
- `structure`
- `description`

Structure enum：

- `CONTINUOUS`
- `REPEATED_INTERVAL`
- `CIRCUIT`
- `DENSITY_BLOCK`

`conditioningProtocolPolicies` 提供：

- allowedFamilies
- allowedModalities
- allowedWorkMetrics
- stationCountRange
- roundsRange
- workSecondsRange
- restSecondsRange
- transitionSecondsRange
- continuousMinutesRange
- `levelDefaults.L1..L4`
- powerPlacement
- allowMixedMetrics

`levelDefaults` 是 #37 deterministic Resolver 的默认处方来源，不允许 #37 自行发明 work/rest/rounds/stations。

## 6｜Modality V1

固定至少 8 个：

- `CYCLICAL`
- `SLED`
- `CARRY`
- `LOCOMOTION`
- `BALL`
- `SIMPLE_STRENGTH`
- `POWER`
- `CORE_INTEGRATION`

每个 Modality record：

- `id`
- `name`
- `description`
- `v1Status = ACTIVE | RESERVED`

### CARRY 决策

当前 2F 正式 Action 没有独立 Carry；现有 `nongfu_zou` 使用 1F 哑铃路线。

Conditioning 完整课核心执行区由 #38 冻结为 2F，因此 V1 **不把 1F 农夫走伪装成 2F Station，也不把 SLED 错标为 CARRY**。

因此：

- `CARRY` taxonomy 正式存在；
- V1 状态为 `RESERVED`；
- 不进入任何 Family 的 `primaryModalities`；
- #37 默认 Resolver 不得选择 RESERVED Modality；
- 未来新增真实 2F 壶铃 Carry Action 后，可独立把 CARRY 激活，无需改 taxonomy。

其余 7 个 Modality 为 ACTIVE，并必须至少有一个合法 Station candidate。

## 7｜L1–L4 Conditioning Policy

Level 不表示“更花哨动作”，主要控制：

- total main-work duration
- work/rest envelope
- station count
- impact ceiling
- coordination ceiling
- target RPE
- power exposure

冻结 V1：

### L1
- impact ceiling：MEDIUM
- coordination ceiling：LOW
- main duration：15–24 min
- work：20–45s
- rest：30–60s
- transition：20–40s
- station count：1–3
- target RPE：5–6
- max power stations：1

### L2
- impact ceiling：MEDIUM
- coordination ceiling：MEDIUM
- main duration：18–28 min
- work：25–60s
- rest：20–60s
- transition：15–35s
- station count：1–4
- target RPE：6–7
- max power stations：1

### L3
- impact ceiling：HIGH
- coordination ceiling：MEDIUM
- main duration：22–32 min
- work：30–75s
- rest：15–45s
- transition：15–30s
- station count：2–5
- target RPE：7–8
- max power stations：2

### L4
- impact ceiling：HIGH
- coordination ceiling：HIGH
- main duration：25–36 min
- work：30–90s
- rest：10–40s
- transition：10–30s
- station count：2–6
- target RPE：7–9
- max power stations：2

这些是 7Fit V1 门店处方边界，不声明为普遍训练学唯一标准。

L4 仍允许低冲击、低协调的稳定设备动作。

## 8｜Protocol policy defaults

### STEADY
- Family：CON-01
- Modality：CYCLICAL
- station = 1
- rounds = 1
- no work/rest cycling
- continuous defaults：L1 18 / L2 22 / L3 26 / L4 30 min

### INTERVAL
- Family：CON-01 / 02 / 03 / 04
- station 1–3
- rounds 4–10
- L1 default：30s work / 45s rest / 5 rounds / 1 station
- L2：40 / 40 / 6 / 1
- L3：45 / 30 / 7 / 2
- L4：60 / 30 / 8 / 2

### CIRCUIT
- Family：CON-02 / 03 / 04
- station 3–6
- rounds 2–5
- L1：30 / 30 / 2 rounds / 3 stations
- L2：35 / 25 / 3 / 3
- L3：40 / 20 / 3 / 4
- L4：45 / 15 / 4 / 4

### DENSITY
- Family：CON-03 only
- station 3–5
- rounds 2–5
- power modality excluded by default
- L1：30 / 20 / 2 / 3 / 12-min cap
- L2：35 / 15 / 3 / 3 / 15-min cap
- L3：40 / 15 / 3 / 4 / 18-min cap
- L4：45 / 10 / 4 / 4 / 22-min cap

#37 may deterministically adjust within both Level and Protocol ranges, but cannot exceed either contract.

## 9｜Station Action Metadata

`conditioningActionMeta: Record<ActionId, ConditioningActionMeta>` is the sole Station whitelist.

Required fields:

- `modalities`
- `protocolEligibility`
- `workMetric`
- `impact`
- `coordinationDemand`
- `fatigueRisk`
- `levelRange: {min,max}`
- `powerEligible`
- `stressFocus`

Enums:

- workMetric：`TIME | DISTANCE | REPS | CALORIES`
- impact：`LOW | MEDIUM | HIGH`
- coordinationDemand：`LOW | MEDIUM | HIGH`
- fatigueRisk：`LOW | MEDIUM | HIGH`
- stressFocus：`LOWER | UPPER | FULL_BODY | CORE`

An action may carry multiple modalities, e.g. kettlebell swing can be `SIMPLE_STRENGTH + POWER`.

V1 legal Action routes for Station whitelist:

- `CONDITIONING_2F`
- explicitly audited `2F_ONLY`
- explicitly audited `FLEX_1F_2F`

Illegal:

- `1F_ONLY`
- `POST_CARDIO_ONLY`
- `RECOVERY_2F`
- PREP-only actions

This explicitly prevents treadmill/stair post-cardio actions from silently becoming formal Conditioning Stations.

## 10｜Initial Station audit boundary

All current 18 `CONDITIONING_2F` actions receive explicit metadata.

Additional 2F/FLEX actions may be admitted only by manual audit to cover:

- SIMPLE_STRENGTH: goblet squat / kettlebell deadlift / kettlebell swing
- CORE_INTEGRATION: selected core actions such as medicine-ball rotation / controlled trunk stability

No candidate is generated from action name or existing `pattern`.

ACTIVE Modality coverage is CI-gated. RESERVED CARRY is intentionally exempt until a real 2F Carry Action exists.

## 11｜Transition / venue policy

`conditioningTransitionPolicy` freezes:

- default zone = 2F 体能热身大厅
- full Conditioning defaults to no post-cardio
- cross-floor default = false
- station candidates must be executable without forced 1F ↔ 2F shuttling
- transition time is part of Protocol prescription
- PREP and Recovery remain separate from Protocol work duration

No UI logic is implemented in #36.

## 12｜Conflict policy data

`conditioningConflictPolicy` stores thresholds only; algorithm belongs to #37 plugin.

Must provide data for:

- impact ceiling
- coordination ceiling
- power placement
- max consecutive high-fatigue stations
- same-modality redundancy
- same-stress-focus redundancy
- total duration tolerance
- work/rest legality
- max power stations by level

No PASS/WARN/FAIL evaluator is implemented in #36.

## 13｜Schema / validator

Create `schemas/v14.8/conditioning.schema.json`.

Schema/validator reject:

- missing/unknown Family, Protocol, Modality, Level
- invalid Family ↔ Protocol refs
- ACTIVE Modality without candidate coverage
- RESERVED Modality used as Family primary modality
- unknown Action ID
- illegal Action route/status
- POST_CARDIO_ONLY Station metadata
- invalid workMetric / impact / coordination / fatigue / stressFocus
- invalid level range ordering
- protocolEligibility pointing to unknown/illegal Protocol
- `powerEligible=true` action with no POWER modality
- POWER modality action with `powerEligible=false`
- Protocol defaults outside Protocol or Level bounds
- defaultProtocol not in Family allowedProtocols

## 14｜#36 scope

做：
- conditioning.json
- Family / Protocol / Modality / Level / protocol defaults
- Station candidate metadata
- transition/conflict policy data
- schema / validator / manifest / generated runtime
- audit doc and CI tests

不做：
- #37 Resolver / duration estimator / Conflict evaluator
- #38 UI / Copy / PREP adapter
- State mutation
- timer / audio
- wearable HR
- leaderboard / benchmark / AMRAP / For Time
- F111/Body changes
- automatic Carry invention

## 15｜Success criteria

#36 完成时：

1. Conditioning 有独立 Source of Truth；
2. 4 Family / 4 Protocol / 8 Modality / L1–L4 全部机器可读；
3. Protocol defaults 足以让 #37 deterministic resolve，不需要自行发明处方；
4. Station eligibility 全部显式；
5. impact / coordination / fatigue / power / work metric 全部结构化；
6. POST_CARDIO_ONLY 不可能被当正式 Station；
7. 2F route/transition 边界明确；
8. CARRY 缺口显式而不伪造；
9. CI 能阻止非法 refs / policy / candidate metadata；
10. 不改变 F111 / Body 已发布行为。
