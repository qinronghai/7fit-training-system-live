# 7Fit Training System｜Project Governance V1

## 1. 项目唯一事实源

本仓库是 7Fit Training System 的唯一正式代码源。

- `master`：正式发布主线
- GitHub Issue：任务事实源（Single Source of Truth）
- GitHub Project：任务可视化看板
- Pull Request：实施、测试、Review 与合并记录
- GitHub Pages：正式发布结果

聊天记录、临时交接文档、个人笔记都不能替代 Issue。

## 2. 看板状态

建议 GitHub Project 使用以下状态：

1. `Inbox`：刚提出，尚未评估
2. `Todo`：已确认要做，范围清楚
3. `In Progress`：正在执行
4. `Review`：实现完成，等待测试/复核/合并
5. `Done`：已进入 master 且验收通过
6. `Icebox`：保留，但当前周期不做

## 3. 自定义字段

建议 Project 增加：

- `Priority`：P0 / P1 / P2 / P3
- `Type`：Feature / Bug / Content / Refactor / Research / DevOps
- `Area`：Composer / Actions / PREP / Anatomy / UI / Data / Testing / DevOps / Governance / Cycle
- `Version`：V14.8 / V15 / Future
- `Size`：S / M / L
- `Executor`：ChatGPT / Codex / Manual

## 4. Priority 定义

- `P0`：阻塞正式开发、影响正确性、数据完整性、发布安全或长期架构
- `P1`：高价值功能或明确技术债，应在当前版本解决
- `P2`：有价值但可延期，不阻塞当前主线
- `P3`：探索、锦上添花或长期设想

## 5. Issue 生命周期

所有正式工作都遵循：

`Idea → Issue(Inbox) → Scope Review → Todo → In Progress → PR → Review → master → Done`

规则：

- 未建立 Issue 的功能，不进入正式开发。
- 开始执行前必须有明确目标、范围和验收标准。
- 一个 Issue 尽量只解决一个清晰问题。
- 大任务先拆分，不把多个独立子系统塞进一个 Issue。
- PR 必须关联 Issue。
- Issue 只有在正式代码进入 `master` 且验收通过后才能关闭。

## 6. Issue 必填结构

每个开发 Issue 至少包含：

### 背景 / 为什么做
解释问题、业务价值或风险。

### 目标
一句话说明完成后系统应达到什么状态。

### 范围
明确本 Issue 要改什么。

### 不做什么
明确边界，防止范围漂移。

### 验收标准
使用可验证的 checklist。

### 测试要求
列出需要新增或通过的测试。

### 相关模块
列出可能涉及的文件、模块或数据域。

### 风险 / 兼容性
说明是否影响 V14.7 已冻结规则、既有 Session、Pages 或数据结构。

## 7. PR 规范

每个 PR 至少说明：

- 关联 Issue
- 改了什么
- 为什么这样改
- 测试结果
- 是否影响数据 Schema / UI / 路由 / 发布
- 是否需要迁移或兼容处理

禁止：

- 未经过测试直接合并
- 在 PR 中顺手做与 Issue 无关的大范围重构
- 用聊天中的口头结论覆盖 Issue / PR 中的正式决策

## 8. Definition of Done

一个任务只有同时满足以下条件才是 `Done`：

- [ ] Issue 验收标准全部满足
- [ ] 自动测试通过
- [ ] 必要的浏览器 Smoke 通过
- [ ] PR 已 Review
- [ ] 已合并进 `master`
- [ ] Pages / 正式运行状态正常（如涉及前端）
- [ ] 文档 / Schema / 验证文件已同步（如需要）
- [ ] Issue 已记录最终结论并关闭

## 9. 7Fit 当前开发原则

### 9.1 产品层

当前主线优先级：

1. 场馆训练知识库
2. 女性综合 F111 编课系统
3. Coach Workflow
4. 12/16/32/64 节周期系统
5. 后续 Coach App

### 9.2 训练领域冻结规则

任何任务不得无意破坏已确认的 V14.7 规则，包括：

- F111 = 一下肢 + 一上肢 + 一支撑
- 5 个下肢模式 × 4 个上肢模式 = 20 个合法组合
- Session L1–L4 与 Main T / SUPPORT S / CORE-L 独立
- `SUPPORT` 中文固定为“支撑模式”
- D1/D2 必须补充而不是简单复制 A/B
- 跑步机 / 楼梯机只用于课后有氧，不作为热身
- 3F Pilates 独立于 F111
- 品牌主色 `#9566F2`
- 7Fit Logo 原始字形不得重设计

涉及这些规则的修改必须单独建 Issue，并在 PR 中明确说明兼容性。

## 10. 当前版本治理目标

V14.8 的主要定位不是大量新增训练内容，而是：

**Foundation & Coach Workflow**

优先处理：

- 数据 Schema
- 数据拆分
- 关键业务规则显式化
- 自动化校验
- 浏览器 Smoke
- Composer / Coach UX
- Session 保存与快速操作

待底座稳定后，再进入 12/16/32/64 节周期编排与更完整的 Coach App 能力。
