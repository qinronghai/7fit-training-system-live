# Issue #4｜system-data.js 领域拆分设计规范

## Status

- Issue：#4 `[P0][Data] 拆分 system-data.js 数据域并保留统一 Runtime 输出`
- Branch：`refactor/issue-4-split-system-data`
- Decision：采用 **方案 A｜领域源数据拆分 + 自动生成 Runtime Bundle**
- Design date：2026-09-10

## 1. 目标

把当前约 556 KB、同时承载多个训练数据域的 `data/system-data.js` 从“人工维护的唯一源文件”改造成“自动生成的兼容 Runtime Bundle”。

新的 Source of Truth 位于 `data/src/`，按训练领域拆分为多个 JSON 文件；构建工具负责把这些领域文件确定性聚合为与当前浏览器契约兼容的：

```js
window.V14_DATA={...};
```

本次重构的核心目标不是改变训练内容，而是降低数据维护复杂度、减少多人/多任务并行时的合并冲突，并为后续 V14.8/V15 的训练知识库、周期训练和更多模板扩展建立稳定的数据基础。

## 2. 硬约束

以下要求在 Issue #4 中全部冻结：

1. 浏览器继续通过 `window.V14_DATA` 读取统一 Runtime 数据。
2. `index.html` 继续加载 `data/system-data.js`；不改成浏览器运行时 fetch JSON，也不引入 ES Modules。
3. 现有 Coach / Composer / System / Rules / Library / Maintenance 页面不得因为数据拆分而修改业务语义。
4. 不修改当前动作、课程、SUPPORT、CORE、PREP、Foam、Composer 的训练内容。
5. 不改变 Issue #3 已冻结的 V14.8 Schema 契约。
6. 不改变 Issue #5 已冻结的 D1/D2 `1F_ONLY` 路由规则。
7. 不拆分 `data/anatomy-data.js`；它属于独立后续重构范围。
8. 不引入 React、Vue、Vite、Webpack、Rollup 或 Node 构建依赖。
9. 构建链使用仓库已有 Python 环境；浏览器 Runtime 继续保持 dependency-free。
10. GitHub Pages 仍然发布纯静态文件。

## 3. 当前 Runtime 契约

当前页面在任何业务 JS 之前同步加载：

```html
<script src="data/system-data.js"></script>
<script src="data/anatomy-data.js"></script>
```

现有代码直接读取例如：

```js
window.V14_DATA.sessions
window.V14_DATA.actions
window.V14_DATA.composer
window.V14_DATA.warmupDetails
window.V14_DATA.tenPatternCatalog
```

因此 Issue #4 采用 **build-time split / runtime monolith**：维护层拆分，运行时接口不拆。

## 4. 选定架构

```text
领域 JSON Source of Truth
        ↓
tools/build_system_data.py
        ↓
确定性 top-level merge
        ↓
data/system-data.js   [GENERATED]
        ↓
window.V14_DATA
        ↓
现有 V14.7/V14.8 浏览器 Runtime
```

`data/system-data.js` 仍提交到 Git，因此：

- GitHub Pages 不需要服务器端构建；
- 本地直接打开静态页面的能力不变；
- PR 可以直接审查生成结果；
- CI 可以检查生成文件是否与源数据同步。

## 5. 目录设计

目标目录：

```text
data/
├── src/
│   ├── actions.json
│   ├── patterns.json
│   ├── sessions.json
│   ├── support.json
│   ├── core.json
│   ├── prep.json
│   ├── foam.json
│   ├── composer.json
│   ├── venue.json
│   └── system.json
├── system-data.js          # GENERATED，浏览器正式 Runtime bundle
└── anatomy-data.js         # 本 Issue 不动

tools/
├── build_system_data.py
└── validate_v148_schema.py

tests/
└── test_v148_data_build.py
```

### 5.1 每个 source 文件的格式

每个领域 JSON 都是一个 **partial `V14_DATA` object**，即它拥有一个或多个完整的顶层 key，而不是任意深层 patch。

示例：

```json
{
  "supportIds": ["..."],
  "supportDetails": {
    "...": {}
  }
}
```

Composer：

```json
{
  "composer": {
    "lowerModes": {},
    "upperModes": {}
  }
}
```

这样构建工具只做顶层组合，不做隐式 deep merge。

### 5.2 为什么禁止 deep merge

如果多个文件都能修改 `composer`、`actions` 或其他同一顶层对象，维护者无法仅通过文件位置判断字段所有权，并会重新产生隐性耦合。

因此每个顶层 key **必须且只能由一个领域文件拥有**。

构建器遇到重复顶层 key 时立即失败：

```text
Duplicate top-level key: composer
owned by: composer.json
also found in: system.json
```

## 6. 领域所有权

拆分遵循“业务责任”而不是文件大小。

### `actions.json`

拥有完整 `actions` map，包括动作身份、模式、route、tier、器械、状态以及现有动作级附加元数据。

### `sessions.json`

拥有 F111 Session Runtime 数据以及只服务 Session / Recipe Family 的顶层集合。

典型内容包括：

- `sessions`
- `recipeIds`
- 与 Recipe Family / Session 直接绑定且当前已经存在的 companion metadata

### `support.json`

拥有 SUPPORT 正式体系的顶层集合，例如：

- `supportIds`
- `supportDetails`
- 只属于 SUPPORT 体系的映射/说明数据

### `core.json`

拥有 CORE 正式体系：

- `coreIds`
- `coreDetails`
- 只属于 CORE 的映射/说明数据

### `prep.json`

拥有 PREP：

- `warmupIds`
- `warmupDetails`
- `warmupMatchByPattern`
- 只属于 PREP 匹配器的顶层配置

### `foam.json`

拥有 Foam：

- `foamRollIds`
- `foamRollDetails`
- `foamRollMatchByPattern`

### `composer.json`

拥有：

- `composer`
- 只由 Composer resolver 使用的顶层配置

其中继续冻结：5 lower × 4 upper、8 official presets、L1–L4、Core Demand、D1/D2 policy。

### `patterns.json`

拥有训练体系目录和动作模式知识层的顶层对象，例如现有 `eightPatterns`、`tenPatternCatalog` 及与模式展示/索引直接绑定的顶层结构。

### `venue.json`

拥有场馆层级、楼层、器械约束、替换规则或 Venue Truth 类顶层配置。

只迁移当前 bundle 已经存在的数据；Issue #4 不新增新的场馆规则。

### `system.json`

拥有真正的系统级 metadata，以及不属于某个训练业务域的顶层配置，例如版本标记。

`system.json` **禁止**成为“其他都塞这里”的垃圾桶。任何可明确归属 actions / sessions / patterns / support / core / prep / foam / composer / venue 的字段都必须进入对应文件。

## 7. 顶层 key inventory

迁移开始时，构建工具相关测试必须先记录当前 `window.V14_DATA` 的完整顶层 key 集合。

迁移完成后必须满足：

```text
union(all data/src/*.json top-level keys)
==
current formal V14_DATA top-level keys
```

并且：

```text
intersection(keys(file_a), keys(file_b)) == ∅
```

任何漏迁 key 或重复 key 都必须阻断 CI。

本设计不允许因为“暂时不知道放哪里”而静默删除字段。

## 8. 构建器

新增：

```text
tools/build_system_data.py
```

### 8.1 固定接口

```bash
python tools/build_system_data.py
```

行为：

1. 按固定顺序读取 `data/src/*.json` 的正式领域文件；
2. 验证每个文件顶层必须是 JSON object；
3. 验证不存在重复顶层 key；
4. 合并为一个 Python dict；
5. 用 UTF-8、`ensure_ascii=False`、稳定 separators 生成：

```js
window.V14_DATA=<canonical-json>;
```

6. 写入 `data/system-data.js`。

### 8.2 Check mode

必须支持：

```bash
python tools/build_system_data.py --check
```

`--check` 不修改文件，而是在内存生成预期 bundle，并与仓库中的 `data/system-data.js` 比较。

不同步时返回非 0：

```text
system-data.js is stale; run: python tools/build_system_data.py
```

### 8.3 Determinism

相同 `data/src` 输入必须永远生成相同 bytes。

规范：

```python
json.dumps(
    payload,
    ensure_ascii=False,
    separators=(",", ":"),
    sort_keys=False,
)
```

顶层 key 顺序由构建器固定的 source file 顺序决定；每个领域文件内部保留 JSON 文件中的插入顺序。

生成文件只允许一个统一格式，不接受手工格式化版本。

## 9. Source of Truth 规则

Issue #4 合并后：

### 允许

编辑：

```text
data/src/*.json
```

然后执行：

```bash
python tools/build_system_data.py
```

### 禁止

直接手工编辑：

```text
data/system-data.js
```

CI 的 `--check` 会阻止“只改 bundle、不改 source”以及“只改 source、忘记重新 build”两种漂移。

## 10. 迁移策略

必须小步完成，不进行一次性人工复制重写。

### Phase 1｜Freeze baseline

从当前正式 `master` 的 `data/system-data.js` 解析出完整 payload。

建立回归测试，冻结：

- payload 顶层 key 集合；
- 已由 #3 冻结的 32 Session / 8 Recipe / 30 SUPPORT / 20 CORE / 20 PREP / 12 Foam；
- 243 Action 当前 inventory；
- Composer 5 × 4、8 preset 等既有契约。

### Phase 2｜Mechanical split

通过脚本/确定性转换把当前 payload 的顶层 key 分配到各领域 JSON。

禁止在迁移过程中顺手：

- 改动作名；
- 改 tier；
- 改 route；
- 改课表；
- 改排序；
- 修“看起来像错误”的训练内容；
- 新增训练动作。

发现内容问题时另开 Issue。

### Phase 3｜Build parity

由 source 重新生成 `data/system-data.js`。

先验证 semantic parity：

```python
load_generated_bundle() == load_frozen_baseline_bundle()
```

在 semantic parity 成立后，generated bundle 才能替代旧人工 bundle。

### Phase 4｜Make source authoritative

测试和 Validator 的加载链调整为：

```text
data/src → build/check → data/system-data.js → schema/runtime tests
```

现有浏览器代码仍从 `data/system-data.js` 读取。

## 11. 与 Issue #3 Schema Gate 的关系

#3 已建立：

```text
V14_DATA → JSON Schema → cross-record invariants
```

#4 在它前面增加一层：

```text
data/src
   ↓
build_system_data.py --check
   ↓
data/system-data.js
   ↓
validate_v148_schema.py
   ↓
Python / Node / JS runtime tests
```

Schema 不负责判断 bundle 是否过期；build check 不负责重新定义训练 Schema。两者职责分离。

## 12. 测试设计

新增：

```text
tests/test_v148_data_build.py
```

至少覆盖：

### 12.1 RED：源目录不存在/不完整

在第一步测试中要求 `data/src` 和正式领域文件存在；当前 branch 应先失败。

### 12.2 顶层 key 唯一所有权

构造两个 fragment 都包含：

```json
{"composer": {}}
```

必须失败并明确报告 duplicate owner。

### 12.3 Missing key

从 fragment set 中删除一个冻结的顶层 key，必须失败 inventory parity。

### 12.4 Deterministic build

连续生成两次，结果 bytes 完全一致。

### 12.5 Stale bundle

修改 source 但不更新 `system-data.js`，`--check` 必须返回失败。

### 12.6 Semantic parity

迁移后的 source 聚合 payload 必须与 Issue #4 起始 baseline payload 深度相等。

### 12.7 Schema continuity

执行：

```bash
python tools/validate_v148_schema.py
```

必须继续 PASS。

### 12.8 Runtime continuity

全部现有 Python tests、Node runtime tests、JS syntax tests 必须继续通过。

特别要求保持：

- 80/80 Composer states；
- 20/20 5×4 combinations；
- 32/32 official Sessions；
- PREP / Foam / SUPPORT / CORE inventory；
- D1/D2 `1F_ONLY`；
- Action/Anatomy/Conflict/Copy 相关 runtime tests。

## 13. Browser Smoke

由于 `index.html` 的加载方式保持不变，#4 不需要把浏览器加载器改成新的异步体系，但合并前必须做至少以下 Smoke：

1. `#/coach` 可以渲染；
2. `#/coach/compose` 可以渲染；
3. 一个官方 F111 Session 可以打开；
4. 一个自由组合 Session 可以 resolve 六槽；
5. PREP / Foam 推荐可显示；
6. Library 可以读取动作；
7. 页面没有 `ReferenceError: V14_DATA`；
8. 页面没有因 bundle 生成顺序造成的 undefined 数据错误。

如果 #6 Browser CI 已完成，则复用 Playwright Gate；如果 #6 尚未完成，本 Issue 只沿用仓库当前可用的 browser/manual smoke，不在 #4 中扩大为完整 Playwright 项目。

## 14. CI / Pages Gate

现有 `V14.8 Schema Check` 与 `Deploy 7Fit Training System` 都应在 Schema Validator 之前增加：

```bash
python tools/build_system_data.py --check
```

推荐顺序：

```text
pytest
→ build_system_data.py --check
→ validate_v148_schema.py
→ Node runtime tests
→ JS syntax
→ Pages artifact/deploy
```

这样任何 source/bundle 漂移都无法进入 `master`。

## 15. Error handling

构建器必须 fail-fast，并返回可定位错误。

必须阻断：

- source JSON 语法错误；
- source 顶层不是 object；
- duplicate top-level key；
- 正式领域文件缺失；
- bundle 与 source 不同步；
- 迁移阶段 baseline key 遗失。

不得：

- 自动吞掉未知字段；
- 自动把冲突字段覆盖成“最后一个文件胜出”；
- 自动修改训练数据以通过 Schema；
- 在 build 时引入业务默认值。

## 16. Rollback

Issue #4 不改变浏览器接口，因此回滚简单：

1. revert #4 merge commit；
2. `index.html` 仍然指向 `data/system-data.js`；
3. 上一个正式 bundle 可立即恢复。

不需要数据 migration rollback，也不涉及用户端存储格式升级。

## 17. Documentation

合并前更新：

- `docs/V14.8-SCHEMA.md`：说明 Validator 输入仍为 generated runtime bundle；
- 新增 `docs/V14.8-DATA-MAINTENANCE.md`：说明如何编辑领域数据、build、check、validate；
- README 中明确：`data/system-data.js` 为 GENERATED，不接受直接人工修改。

## 18. Definition of Done

Issue #4 只有在以下全部满足后才能关闭：

- [ ] `data/src` 已按领域拆分；
- [ ] 每个顶层 key 只有一个 owner；
- [ ] `tools/build_system_data.py` 支持 build 与 `--check`；
- [ ] `data/system-data.js` 明确成为 generated artifact；
- [ ] 聚合 payload 与拆分前 baseline semantic parity 成立；
- [ ] V14.8 Schema Validator PASS；
- [ ] 全量 Python tests PASS；
- [ ] 全量 Node runtime tests PASS；
- [ ] JS syntax PASS；
- [ ] Composer 80/80 状态不回归；
- [ ] 关键页面 Smoke PASS；
- [ ] PR 独立 Review 无未解决 Important/Critical finding；
- [ ] merge 到 `master`；
- [ ] Pages Release Gate 成功；
- [ ] Issue #4 关闭为 Completed。

## 19. 明确不属于 #4 的后续工作

以下内容不得顺带进入本 PR：

- `anatomy-data.js` 拆分；
- Coach UI 重构；
- `views-coach.js` 拆分；
- Playwright 完整体系（属于 #6）；
- Main tier 显式元数据改造（属于 #7）；
- 搜索、收藏、最近使用、Session 保存；
- 12/16/32/64 周期系统；
- 新训练动作或训练内容校订；
- 浏览器异步数据加载/ES Modules。

这些工作以后可以直接消费 #4 形成的领域 Source of Truth，但不能扩大本 Issue 的风险面。
