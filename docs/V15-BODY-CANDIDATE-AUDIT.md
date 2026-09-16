# Body Candidate Audit｜#33 / #93

状态：人工准入白名单；`bodyActionMeta` 为 Body 候选唯一运行时事实源，#93 在此基础上增加 Family × Level Pool 与 Progression Chain。

审计原则：只纳入现有正式 Action ID；必须为 1F/FLEX 力量路径且可自动编排；不从 Anatomy 自动推断 Direct Work Sets；不为凑数纳入体能/恢复节点。#93 允许经过人工审计的“动作学习节点”进入 Body 正式工作组，例如三点杆髋铰链、基础肩胛划船与辅助引体肩胛下沉，因为它们承担 L1 的正式模式学习职责。

**主项语义 Gate：任何包含 `PRIMARY` / `SECONDARY` 的 Candidate，其 `directTargets` 必须至少命中所属 Family 的 `primaryTargets`。#92 负责通用能力资格，#93 负责 Family × Level 正式 Pool，#68 负责 Slot Intent；三层同时通过后才是合法候选。**

明确排除：`smith_tuntui`（7Fit 场馆规则：臀推最高使用臀推机，不采用史密斯/杠铃臀推）。#94 的哈克/六角杠最低负重 Gate 不在 #93 内伪造，后续由 Venue 数据接入。

当前候选数：**68**。

| Action ID | 动作 | Family | Level | Role | Direct Targets | Secondary Targets | Class | Fatigue | Stability | Profile | Laterality | Route | 审计备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tushen_shendun | 徒手深蹲 | BODY-01 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | quadriceps | glute_max / adductors | compound | low | low | accessory_compound | bilateral | FLEX_1F_2F | 人工准入；主项角色命中 Family primary target |
| movement_bench_box_squat | 触凳箱式深蹲 | BODY-01 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps | glute_max / adductors | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| banjie_hake | 半蹲哈克 | BODY-01 | L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps | glute_max | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| hake_shendun | 哈克深蹲 | BODY-01 | L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps | glute_max / adductors | compound | high | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| smith_shendun | 史密斯深蹲 | BODY-01 | L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps | glute_max / adductors | compound | high | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_light_bar_box_squat | 轻杠铃箱式深蹲 | BODY-01 | L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps | glute_max / adductors | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| gangling_shendun | 杠铃深蹲 | BODY-01 | L4 | PRIMARY / SECONDARY | quadriceps | glute_max / adductors | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 调整为 L4 新准入端点；低等级稳定动作继续向上保留 |
| movement_supported_split_squat | 扶持分腿蹲 | BODY-01 | L1 / L2 / L3 / L4 | SECONDARY / ACCESSORY | quadriceps / glute_max | adductors | compound | medium | low | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_bodyweight_split_squat | 徒手分腿蹲 | BODY-01 | L1 / L2 / L3 / L4 | SECONDARY / ACCESSORY | quadriceps / glute_max | adductors | compound | medium | medium | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_dumbbell_reverse_lunge | 哑铃反向箭步蹲 | BODY-01 | L2 / L3 / L4 | SECONDARY / ACCESSORY | quadriceps / glute_max | adductors | compound | high | medium | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| baojiayali_fentundun | 保加利亚分腿蹲 | BODY-01 | L2 / L3 / L4 | SECONDARY / ACCESSORY | quadriceps / glute_max | adductors | compound | high | high | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| tui_qushen | 坐姿腿屈伸 | BODY-01 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | quadriceps | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| tui_wanju | 坐姿腿弯举 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | hamstrings | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| kuangwai_zhan | 坐姿髋外展 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | glute_med | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| xiao_longmen_wai_zhan | 绳索站姿髋外展 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | glute_med | — | isolation | low | low | isolation_large | unilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| kuangnei_shou | 髋内收 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | adductors | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| shengsuo_kuan_neishou | 绳索站姿髋内收 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | adductors | — | isolation | low | low | isolation_large | unilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| tunbu_houti | 臀部后踢腿 | BODY-01 / BODY-02 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | glute_max | — | isolation | low | low | isolation_large | unilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| tunqiao | 臀桥 | BODY-02 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | glute_max | hamstrings | accessory | low | low | accessory_compound | bilateral | FLEX_1F_2F | 人工准入；主项角色命中 Family primary target |
| tun_tui | 臀推机 | BODY-02 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | glute_max | hamstrings | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| hipthrust_pause_main | 臀推停顿主项 | BODY-02 | L2 / L3 / L4 | PRIMARY / SECONDARY | glute_max | hamstrings | compound | high | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_single_leg_hip_thrust | 单腿臀推 | BODY-02 | L2 / L3 / L4 | SECONDARY / ACCESSORY | glute_max | hamstrings | compound | medium | medium | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| yaling_luomaniya_yingla | 哑铃罗马尼亚硬拉 | BODY-02 | L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | hamstrings / glute_max | adductors | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| shanyan_tingshen | 山羊挺身 | BODY-02 | L1 / L2 / L3 / L4 | SECONDARY / ACCESSORY / ISOLATION | glute_max / hamstrings | — | accessory | medium | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| backext_load_main | 山羊挺身负重主项 | BODY-02 | L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | glute_max / hamstrings | — | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| dileigan_hinge | 地雷杆髋铰链 | BODY-02 | L2 / L3 / L4 | PRIMARY / SECONDARY | glute_max / hamstrings | adductors | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| liujiao_gantui_yingla | 六角杠硬拉 | BODY-02 | L3 / L4 | PRIMARY / SECONDARY | glute_max / hamstrings | quadriceps | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| gangling_yingla | 杠铃硬拉 | BODY-02 | L4 | PRIMARY / SECONDARY | glute_max / hamstrings | adductors | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 调整为 L4 新准入端点；低等级稳定动作继续向上保留 |
| movement_supported_single_leg_hinge | 扶持单腿髋铰链（徒手） | BODY-02 | L1 / L2 / L3 / L4 | SECONDARY / ACCESSORY | glute_max / hamstrings | — | compound | medium | low | single_leg_compound | unilateral | 1F_ONLY | 人工准入；#93 下放到 L1，作为扶持单腿髋铰链入口 |
| movement_supported_db_single_leg_rdl | 扶持哑铃单腿罗马尼亚硬拉 | BODY-02 | L2 / L3 / L4 | SECONDARY / ACCESSORY | glute_max / hamstrings | — | compound | medium | medium | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_db_single_leg_rdl | 独立哑铃单腿罗马尼亚硬拉 | BODY-02 | L3 / L4 | SECONDARY / ACCESSORY | glute_max / hamstrings | — | compound | high | high | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| movement_advanced_db_single_leg_rdl | 高阶负重单腿罗马尼亚硬拉 | BODY-02 | L3 / L4 | SECONDARY / ACCESSORY | glute_max / hamstrings | — | compound | high | high | single_leg_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| feiji_labei_zhongba | 飞机拉背中把位 | BODY-03 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| zuozi_huachuan_bianshi | 坐姿划船（变式） | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| diwei_huachuan | 低位划船 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| danbi_yaling_huachuan | 单臂哑铃划船 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | upper_back / lats | biceps | compound | high | medium | compound_freeweight | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| smith_huachuan | 史密斯俯身划船 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | high | medium | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| dileigan_huachuan | 地雷杆划船 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| gangling_huachuan | 杠铃划船 | BODY-03 | L4 | PRIMARY / SECONDARY | upper_back / lats | biceps | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 调整为 L4 新准入端点；低等级稳定动作继续向上保留 |
| gaowei_xiala_vba | 高位下拉-V把正手 | BODY-03 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | lats | upper_back / biceps | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| gaowei_xiala_kuanwo | 高位下拉-宽握 | BODY-03 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | lats | upper_back / biceps | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| danbi_xiala | 单臂下拉 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | lats | biceps | compound | medium | medium | accessory_compound | unilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| fuzhu_yinti_zhaiwo | 辅助窄距对握引体 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | lats / upper_back | biceps | compound | high | medium | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| fuzhu_yinti_kuanwo | 辅助宽握引体 | BODY-03 | L2 / L3 / L4 | PRIMARY / SECONDARY | lats / upper_back | biceps | compound | high | medium | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| zhibi_xiala | 直臂下拉 | BODY-03 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | lats | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| houzu_sanji | 哑铃俯身反向飞鸟 | BODY-03 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | rear_delts | upper_back | isolation | low | medium | isolation_small | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| mianla | 面拉 | BODY-03 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | rear_delts / upper_back | — | accessory | low | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| shengsuo_ertou_wanju | 绳索二头弯举 | BODY-03 / BODY-04 | L1 / L2 / L3 / L4 | ISOLATION / OPTIONAL | biceps | — | isolation | low | low | isolation_small | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| shengsuo_cepingju | 绳索侧平举 | BODY-03 / BODY-04 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | lateral_delts | — | isolation | low | low | isolation_small | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| movement_incline_pushup | 上斜俯卧撑 | BODY-04 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | chest / triceps | front_delts | compound | medium | medium | accessory_compound | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| qixie_xiongtui | 器械胸推 | BODY-04 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | chest / triceps | front_delts | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| smith_wotu | 史密斯卧推 | BODY-04 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | chest / triceps | front_delts | compound | high | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| wotu_xiong_tui | 哑铃卧推 | BODY-04 | L2 / L3 / L4 | PRIMARY / SECONDARY | chest / triceps | front_delts | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| gangling_wotu | 杠铃卧推 | BODY-04 | L4 | PRIMARY / SECONDARY | chest / triceps | front_delts | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 调整为 L4 新准入端点；低等级稳定动作继续向上保留 |
| shangxie_yaling_wotu | 上斜哑铃卧推 | BODY-04 | L2 / L3 / L4 | PRIMARY / SECONDARY | chest / front_delts | triceps | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| qixie_jian_tui | 器械推肩 | BODY-04 | L1 / L2 / L3 / L4 | SECONDARY / ACCESSORY | front_delts / triceps | lateral_delts | compound | medium | low | compound_machine | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| yaling_jiantui | 哑铃肩推 | BODY-04 | L2 / L3 / L4 | SECONDARY / ACCESSORY | front_delts / triceps | lateral_delts | compound | high | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；主项角色命中 Family primary target |
| shengsuo_santou_xiaya | 绳索三头下压 | BODY-04 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | triceps | — | isolation | low | low | isolation_small | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| xiongjia_jiaxiong | 蝴蝶机夹胸 | BODY-04 | L1 / L2 / L3 / L4 | ACCESSORY / ISOLATION / OPTIONAL | chest | — | isolation | low | low | isolation_large | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| V13_VP_SEATED_LIGHT_DB | 坐姿轻哑铃肩推 | BODY-04 | L1 / L2 / L3 / L4 | ACCESSORY | front_delts | triceps | accessory | low | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；辅助 / 孤立 / 可选角色 |
| V13_SQ_DB_GOBLET | 哑铃高脚杯深蹲 | BODY-01 | L2 / L3 / L4 | PRIMARY / SECONDARY | quadriceps / glute_max | adductors / hamstrings | compound | medium | medium | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| movement_dowel_hip_hinge | 三点杆髋铰链 | BODY-02 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY / ACCESSORY | glute_max / hamstrings | adductors | accessory | low | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| V13_HR_SCAP_ROW | 基础肩胛划船（轻重量） | BODY-03 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | upper_back / lats | rear_delts / biceps | compound | low | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| fuzhu_yinti_jianjia_xiachen | 辅助引体肩胛下沉 | BODY-03 | L1 / L2 / L3 / L4 | PRIMARY / SECONDARY | lats / upper_back | rear_delts | compound | low | low | accessory_compound | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| fuzhu_yinti_xiangshang | 辅助引体向上 | BODY-03 | L3 / L4 | PRIMARY / SECONDARY | lats / upper_back | biceps | compound | medium | medium | compound_machine | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| movement_bodyweight_pullup | 自重引体向上 | BODY-03 | L4 | PRIMARY / SECONDARY | lats / upper_back | biceps | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| movement_halfkneeling_landmine_press | 半跪姿地雷杆推举 | BODY-04 | L3 / L4 | SECONDARY / ACCESSORY | front_delts / triceps | lateral_delts | compound | medium | medium | compound_freeweight | unilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
| movement_barbell_overhead_press | 杠铃站姿推举 | BODY-04 | L4 | SECONDARY | front_delts / triceps | lateral_delts | compound | high | high | compound_freeweight | bilateral | 1F_ONLY | 人工准入；#93 接入既有动作，补齐正式进阶链/学习入口 |
