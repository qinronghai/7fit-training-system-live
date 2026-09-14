# Issue #71｜V14.7 Live 截图验收闭环

本文件记录 #71 的可重复验收方式。目标是验证共享页面残留、F111 PREP CTA、原生下拉、Conditioning 空 Primer 和跨模板保存/恢复状态边界。

## 自动化验收

CI 中的 `tests/issue71_live_audit_browser.spec.js` 覆盖：

- F111 PREP 在 390 / 1080 / 1280 / 1440 宽度下无横向溢出；
- “查看动作详情”保持 `white-space: nowrap`，并在 390px 下拥有完整点击区域；
- PREP 原生 `select` 存在明确 accessible name，并可使用方向键完成真实选择；
- 动作库筛选栏在 390 / 1080 / 1280 / 1440 下自适应，无固定最小列宽导致的溢出；
- Conditioning L1 PRIMER：有合法候选则正常可选；无合法候选则必须显示约束原因、可安全跳过说明及人工安排安全边界；
- browser `pageerror`、console error / warning 必须为空。

现有 `tests/saved_sessions_browser.spec.js` 继续覆盖 Body → F111 的跨模板状态隔离：Body 恢复成功后，进入 F111 不显示 Body 的“已恢复”提示，但全局历史卡片仍明确标记“恢复到 Body L3”。

裸字面量 `\\n` 由 #76 的 artifact hygiene gate 持续阻断。

## 原生 select 的视觉验收方法

PREP 和动作替换继续使用浏览器原生 `<select>`，不为了截图而改造成第二套自定义控件。原生选项 popup 属于浏览器 / OS UI 层，在部分 headless 截图工具中不会被捕获，因此不能把“截图中是否出现 popup”作为唯一通过条件。

重复验收步骤：

1. 打开 `#/coach/f111/f111-01/l1`，桌面和 390×844 各执行一次。
2. 点击任意可替换 PREP 下拉框，真实浏览器中应出现系统原生选项菜单。
3. 按 `Esc` 关闭后，用 `Tab` 聚焦同一控件。
4. 使用 `ArrowDown` / `ArrowUp` 改变选项；页面重新渲染后当前值应保持为新选项，并显示“手动选择”。
5. 辅助功能树应把控件识别为带有“热身动作替换”名称的 combobox/select。
6. 在任何步骤中均不得产生横向溢出、页面异常或 console warning/error。

## Conditioning 空 Primer 语义

空 PRIMER 不再等同于“数据坏了”。当共享 PREP Resolver 在当前等级、冲击和动作模式约束下返回 0 个合法候选时：

- 明确说明当前约束；
- 明确允许跳过该槽并继续其他 PREP；
- 不自动放宽动作准入；
- 教练若人工安排，只能参考当前等级可见、低疲劳、不与正式 Station 重复且符合场馆路线的 PREP 动作；
- 提供 PREP 规则入口。

这保持 Resolver / Conflict / Save / Copy 的既有语义不变。
