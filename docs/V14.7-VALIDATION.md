# 7Fit Training System V14.7｜FINAL Validation

日期：2026-09-08  
状态：**FINAL / Release Gate Passed**

## 1｜版本范围

V14.7 将 F111 从 8 个固定 Recipe 扩展为：

- 8 个 7Fit 官方推荐预设；
- 5 个下肢编课子模式 × 4 个上肢主模式 = 20 个自由组合；
- Session L → Main T / SUPPORT S / CORE-L 独立映射；
- 单腿模式新增「单腿拉」T1–T4；
- D1 / D2 动态辅助推荐；
- 自由组合继续接入 PREP / Foam / Anatomy / Conflict / Copy。

## 2｜最终修正

### 2.1 FLEX 路由

正式力量槽位允许：

- `1F_ONLY`
- `FLEX_1F_2F`

因此 L1 的徒手深蹲、臀桥不会因为路由过滤而缺失。

### 2.2 臀伸 L4 语义

V1.1 场馆标准不强制新增杠铃臀推。V14.7 FINAL 采用：

- 底层动作节点：`hipthrust_pause_main`，仍保持 T3 身份；
- Composer 有效层级：L4 时显示 **T4**；
- T4 高阶处方：**3–4组 × 6–8次｜RIR 1–2**；
- UI 明确说明 T4 是高阶负荷 / 处方层，不代表新增器械动作。

## 3｜自动化验证

### Python

```text
60 passed in 0.24s
```

### Node Runtime

```text
anatomy_runtime_test: PASS
muscle_concentration_conflict_test: PASS
v146_role_filter_test: PASS
v147_runtime_coverage_test: PASS
composer copy: PASS
composer runtime: PASS
composer state/route/conflict: PASS
module copy formatter: PASS
session copy formatter: PASS
session copy v14.6.2: PASS
ten pattern copy: PASS
```

### JavaScript Syntax

```text
all data/*.js + js/*.js: PASS
```

## 4｜80 状态 Composer Release Gate

遍历：

```text
4 个 Session Level
× 5 个下肢模式
× 4 个上肢模式
= 80 个自由组合状态
```

结果：

```text
80 / 80 PASS
每个状态均生成完整 6 个正式槽位：
A / B / C / D1 / D2 / CORE
```

## 5｜数据覆盖

```text
Ten Pattern Catalog       10 / 10
Main top-level patterns     8 / 8
Single-Leg branches         2 / 2
Single-Leg Hinge tiers      4 / 4
Free combinations          20 / 20
Official F111 presets        8 / 8
Official Sessions           32 / 32
SUPPORT                     30 / 30
CORE                        20 / 20
Runtime Anatomy            243 / 243
PREP                        20 / 20
Foam                        12 / 12
```

## 6｜真实 Chromium Smoke

执行环境：`/usr/bin/chromium` + Playwright headless + 单文件预览。

验证：

```text
Desktop 5×4 matrix          20 / 20
Formal slots                 6 / 6
L3 单腿拉 × 水平推           PASS
L3 SUPPORT 默认 S3           PASS
L4 臀伸 effective T4         PASS
L4 处方 3–4×6–8 / RIR 1–2   PASS
教练版复制 T4 / 处方          PASS
L1 FLEX 徒手深蹲              PASS
Mobile selector              PASS
390px scrollWidth            390 / 390
Page errors                  0
```

## 7｜发布结论

V14.7 FINAL 满足设计规范与发布 Gate，可以作为下一阶段 V14.8 / V15 的正式基线。
