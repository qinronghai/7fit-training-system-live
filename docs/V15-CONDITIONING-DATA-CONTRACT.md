# V15 Conditioning Data Contract V1

Issue: #36

## 1. Domain boundary

Conditioning is a protocol-driven domain. It does not reuse F111 strength slots and it does not add a second Conditioning truth source to `actions.json`.

`data/src/conditioning.json` owns:

- Family taxonomy and goals;
- Protocol taxonomy and organization rules;
- Modality taxonomy;
- L1–L4 progression policy;
- Protocol work/rest/round/transition policy;
- formal Conditioning Action metadata;
- transition policy;
- conflict thresholds.

The future #37 Resolver must consume this contract rather than infer rules from Action names.

## 2. Frozen V1 taxonomy

### Families

- `CON-01` — 基础有氧
- `CON-02` — 间歇体能
- `CON-03` — 混合体能
- `CON-04` — 爆发功率

### Protocols

- `STEADY` — continuous aerobic work
- `INTERVAL` — explicit work/rest
- `CIRCUIT` — multi-station rounds
- `DENSITY` — fixed work window

### Modalities

`CYCLICAL / SLED / CARRY / LOCOMOTION / BALL / SIMPLE_STRENGTH / POWER / CORE_INTEGRATION`

`CARRY` is intentionally `RESERVED` in V1. The existing curated farmer-carry Actions are routed to 1F. #36 does not rewrite venue routing merely to fill the taxonomy.

## 3. Formal candidate boundary

V1 freezes 18 formal candidates.

Every formal candidate:

- already exists in `actions.json`;
- has `status=可自动编排`;
- is routed `CONDITIONING_2F`;
- carries explicit Family / Modality / Protocol / Work Metric / Impact / Coordination / Fatigue / Level / Power metadata.

`venue_treadmill_zone2` and `venue_stair_zone2` remain `POST_CARDIO_ONLY`. They are explicitly excluded from formal Conditioning and are not promoted to Session stations.

## 4. Candidate audit

| Action ID | Action | Families | Modalities | Protocols | Levels | Impact | Coordination | Fatigue | Power |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| huaxueji_jiange | 滑雪机间歇 | CON-01/02/03 | CYCLICAL | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| zhansheng_jiange | 战绳间歇 | CON-02/03 | SIMPLE_STRENGTH/CORE_INTEGRATION | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| huaxueji_wentai | 滑雪机稳态 | CON-01 | CYCLICAL | STEADY | L1–L4 | low | low | low | no |
| zhansheng_bolang | 战绳波浪 | CON-02/03 | SIMPLE_STRENGTH/CORE_INTEGRATION | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| paotong_baidong | 炮筒摆动 | CON-02/03 | SIMPLE_STRENGTH/CORE_INTEGRATION | INTERVAL/CIRCUIT/DENSITY | L2–L4 | low | medium | medium | no |
| yaoqiu_zaidi | 药球砸地 | CON-02/03/04 | BALL/POWER | INTERVAL/CIRCUIT | L1–L4 | low | low | medium | yes |
| tiaoxiang_dengjie | 跳箱登阶 | CON-02/03 | LOCOMOTION/SIMPLE_STRENGTH | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| dengshanpao | 登山跑 | CON-02/03 | LOCOMOTION/CORE_INTEGRATION | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| huachuanji_jiange | 划船机间歇 | CON-01/02/03 | CYCLICAL | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | no |
| huachuanji_wentai | 划船机稳态 | CON-01 | CYCLICAL | STEADY | L1–L4 | low | low | low | no |
| xueqiao_tui | 雪橇推 | CON-02/03/04 | SLED/SIMPLE_STRENGTH/POWER | INTERVAL/CIRCUIT/DENSITY | L1–L4 | low | low | medium | yes |
| xueqiao_la | 雪橇后退拖行 | CON-02/03 | SLED/SIMPLE_STRENGTH | INTERVAL/CIRCUIT/DENSITY | L2–L4 | low | low | medium | no |
| qiangqiu_toushe | 墙球投掷 | CON-02/03/04 | BALL/POWER/SIMPLE_STRENGTH | INTERVAL/CIRCUIT | L2–L4 | medium | medium | high | yes |
| venue_jumping_jack_interval | 开合跳间歇 | CON-02/03 | LOCOMOTION | INTERVAL/CIRCUIT/DENSITY | L2–L4 | medium | low | medium | no |
| venue_rocket_press_interval | 火箭推间歇 | CON-02/03/04 | BALL/POWER/SIMPLE_STRENGTH | INTERVAL/CIRCUIT | L2–L4 | low | medium | medium | yes |
| venue_kettlebell_swing_interval | 壶铃摇摆间歇 | CON-02/03/04 | POWER/SIMPLE_STRENGTH | INTERVAL/CIRCUIT | L2–L4 | low | medium | high | yes |
| venue_box_jump_interval | 跳箱间歇 | CON-02/03/04 | POWER/LOCOMOTION | INTERVAL/CIRCUIT | L3–L4 | high | high | medium | yes |
| venue_shuttle_run_interval | 跑道折返跑间歇 | CON-02/03/04 | LOCOMOTION/POWER | INTERVAL/CIRCUIT | L3–L4 | high | medium | high | yes |

## 5. Level semantics

L1–L4 progress through:

- total work duration;
- work/rest windows;
- station count;
- rounds;
- target RPE;
- impact ceiling;
- coordination ceiling;
- fatigue ceiling;
- power exposure.

L4 does not mean “more complex tricks”.

The level ceiling controls whether an Action may be eligible at that level. Conflict thresholds separately cap how many high-impact / high-coordination / high-fatigue / power stations may coexist in one Session.

## 6. Release invariants

The validator enforces:

- exact Family / Protocol / Modality identity maps;
- 18 curated V1 formal candidates;
- Action reference integrity;
- `CONDITIONING_2F` route legality;
- no `POST_CARDIO_ONLY` leakage;
- ACTIVE Modality coverage;
- RESERVED Modality non-use;
- Family × Level >= 2 candidates;
- Family × Protocol >= 2 candidates;
- CON-04 × Level >= 2 power-capable candidates;
- Work Metric compatibility with Protocol;
- candidate impact/coordination/fatigue <= level ceilings;
- V1 remains on the 2F formal route.

## 7. Out of scope

#36 does not implement:

- Protocol Engine / Resolver;
- station selection;
- State or swap;
- Copy;
- PREP adapter;
- Coach UI.

Those belong to #37 and #38.
