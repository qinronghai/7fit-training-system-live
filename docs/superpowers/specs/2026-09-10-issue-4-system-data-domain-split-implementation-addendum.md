# Issue #4｜领域数据拆分实现补充说明

本文件记录 Issue #4 在已批准设计规范进入 TDD 实施后，由真实 Runtime inventory 和测试反馈确认的实现细化。它不改变用户批准的方案 A，也不改变训练语义；对下列实现细节，以本补充说明和 `docs/V14.8-DATA-SOURCES.md` 为准。

## 1. Manifest 实际结构

设计阶段使用了概念性的 `fragments[].owns[]` 示例。实施后采用更直接、可机器校验的等价结构：

```json
{
  "formatVersion": 1,
  "sourceFiles": [
    "actions.json",
    "patterns.json",
    "sessions.json",
    "support.json",
    "core.json",
    "prep.json",
    "foam.json",
    "composer.json",
    "venue.json",
    "system.json"
  ],
  "owners": {
    "actions": "actions.json"
  },
  "topLevelOrder": ["actions"],
  "baselinePayloadSha256": "<64 lowercase hex>"
}
```

语义保持一致：每个 `V14_DATA` 顶层 key 必须有且只有一个 owner，任何未登记、重复、漏失或错误归属都 fail-fast。

## 2. `topLevelOrder` 独立冻结 Runtime 枚举顺序

初版设计准备依赖 fragment 顺序决定生成对象的顶层顺序。第一轮 RED 获取真实 26-key inventory 后，实施改为显式 `topLevelOrder`。

原因：

- 领域文件顺序服务维护边界；
- Runtime key 顺序属于兼容输出；
- 两者不应隐式耦合。

Builder 先按 domain fragments 验证所有权，再按 `topLevelOrder` 重新组装 payload。因此源文件可按业务域组织，同时保持拆分前 `window.V14_DATA` 的顶层枚举顺序。

## 3. Baseline SHA-256 只作迁移 provenance

迁移基线：

```text
3bf3874f9e7520c2220b4472e68a51b350b7856460f0987f04f47001c0342358
```

它证明 Issue #4 机械拆分时，拆前与拆后语义 payload 相同。

它**不是**未来内容的永久 equality gate。否则任何后续合法动作、课程或元数据更新都会因为 payload hash 改变而被错误阻止。

持续 CI 的正式职责是：

```text
manifest ownership
+ source → generated bundle freshness
+ V14.8 Schema / cross-record invariants
+ runtime tests
```

未来合法数据更新不需要修改“历史迁移发生时”的 baseline hash。

## 4. 真实迁移结果

机械迁移在 GitHub Actions 隔离环境完成，结果：

```text
26 top-level keys
semantic parity: PASS
runtime byte parity: True
baselinePayloadSha256: 3bf3874f9e7520c2220b4472e68a51b350b7856460f0987f04f47001c0342358
```

域分布：

```text
actions.json  2
patterns.json 5
sessions.json 4
support.json  2
core.json     2
prep.json     4
foam.json     3
composer.json 1
venue.json    0
system.json   3
```

`venue.json` 当前为空是有意的：现有 `V14_DATA` 没有独立 Venue 顶层 key，本 Issue 不为了填满文件而创造新数据。该文件保留正式领域边界，未来只有在产品显式引入 Venue 顶层契约时才获得 owner。

## 5. 一次性迁移工具不进入长期维护面

实施期间使用过一次性机械迁移脚本和 branch-only bootstrap workflow，以避免人工复制约 556 KB Runtime 数据。

在生成 `data/src/*`、完成 semantic/byte parity 和全量回归后，这两个一次性入口均已删除。

长期保留的唯一写入路径是：

```text
edit data/src/*.json
→ python tools/build_system_data.py
→ generated data/system-data.js
```

这避免未来误用“从 generated runtime 反向生成 source”的流程，确保 Source of Truth 单向明确。

## 6. 不变项

本补充说明不改变以下已批准边界：

- `window.V14_DATA` 浏览器接口不变；
- `index.html` 同步加载 `data/system-data.js` 不变；
- 训练内容不变；
- Issue #3 Schema 语义不变；
- Issue #5 D1/D2 `1F_ONLY` 不变；
- `data/anatomy-data.js` 不拆；
- 不引入框架、bundler、ES Modules 或 runtime fetch JSON。
