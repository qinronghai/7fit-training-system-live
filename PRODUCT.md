# 7Fit Coach Center

7Fit Coach Center helps coaches assemble and deliver training sessions from the established template and exercise systems. Member Training records a member's profile alongside planned and completed sessions so the next coaching decision starts from verified training history.

## 本轮验收目标

**教练带完一节课，下次打开这个会员就能看见上次实际练了什么，并根据此排出今天的课。**

用同一名测试会员走完以下流程：

1. 课后记录一个现场替换的动作及实际完成的组数、次数和重量，将这节课标记为已完成。
2. 退出后重新打开该会员，核对上次已完成课程中的动作和训练量与实练记录一致。
3. 从该会员进入 F111 编课，参考上次实练调整今天的安排，保存到该会员名下。再次打开时，今天的课显示为计划，上次的实练记录仍可查看。

## 本轮范围与顺序

本轮集中完善 F111 编课和会员训练记录。其他课型、动作库扩容和全站改版暂缓。

1. **先看不同计划的正式训练。** 保留已有预设和主项进阶。在同等级的自由组合中，比较不同主项下的默认支撑和核心。优先选与主项互补的动作，在同样合适的候选中轮换。教练可以保留有进阶目的的重复动作。
2. **再核对每节课的热身。** 对照当天实际选定的上下肢主项、支撑和核心，检查热身是否为这些动作做准备。主项或支撑被替换后，再检查推荐是否合适。多样性看具体动作和训练目的，仅换顺序不算新增动作。
3. **最后用同一会员串起两次课。** 按上面的验收流程核对现场替换、实练记录和下一次编课。

### 2026-11-20 编课基线

本地工作分支 `243b3a9`，使用默认选项，无会员历史或手动替换。每个等级分别比较 8 个预设和 20 个自由组合。自由组合的默认核心任务为抗伸展。

| 每个等级内的去重结果 | L1 | L2 | L3 | L4 |
| --- | ---: | ---: | ---: | ---: |
| 预设的正式支撑动作数 | 5 | 5 | 4 | 8 |
| 预设的正式核心动作数 | 5 | 5 | 4 | 7 |
| 自由组合的正式支撑动作数 | 1 | 1 | 1 | 1 |
| 自由组合的正式核心动作数 | 1 | 1 | 1 | 1 |
| 自由组合的五步热身序列数 | 17 | 19 | 19 | 18 |

主线 `afe08ae` 在相同条件下也出现了自由组合同等级支撑和核心各只有一种的结果。热身序列按五个动作 ID 及顺序去重，此计数仅衡量整套重复情况，每个动作与当天训练的匹配程度需要逐课核对。

### 本地实施与验收（2026-11-20）

自由组合按同级预设的主项搭配确定默认核心任务。优先匹配上下肢组合，其次参考相同下肢或上肢的预设。教练指定的任务或动作优先。在动作符合任务、等级和近期训练约束时，不同组合可以采用不同默认动作。支撑优先补充核心任务，并按全课躯干负荷选择候选。

| 无会员历史时，每级 20 种自由组合 | L1 | L2 | L3 | L4 |
| --- | ---: | ---: | ---: | ---: |
| 正式支撑动作数 | 3 | 4 | 4 | 4 |
| 正式核心动作数 | 5 | 8 | 5 | 5 |

热身从当天选定动作读取支撑任务与核心需求。单腿拉同时匹配髋铰链和单腿准备动作。32 套预设和 80 种自由组合均可生成五步动态热身。当前 L2 的 20 套组合有 14 套使用四足跪姿单手抬起。80 套默认自由组合中，17 套触发躯干负荷提醒，13 套触发场地提醒，两类可重叠。

手机尺寸浏览器使用测试会员和模拟会员接口，验收覆盖记录现场换动作、3 组 × 10 次 × 20 kg，重新打开会员核对实练，随后改选垂直拉并保存第二节课。在同一会员页面核对首节已完成、次节待训练。

## Member Training

- Put recent completed training and its derived patterns, actions, and muscles before profile details.
- Keep member records in the coaching workflow. Do not turn this surface into a CRM, scheduler, finance view, or recovery-score dashboard.
- Treat a planned session as intent and a completed session as evidence. Only completed sessions inform recent training context.
- Keep the saved plan immutable when recording what happened; retain both planned and performed action snapshots when an action changes.
- Let a coach explicitly choose when a session is saved to a member. Copying course text does not create a member record.
- Keep F111 useful without a member. With a member selected, recent completed actions inform automatic support and core choices. Coaches retain manual control.

## Interface Direction

Extend the current Coach Center's quiet, high-contrast violet and white visual language. Use compact operational lists, clear status text, responsive sheets, and direct actions. Preserve the existing navigation and course flows.
