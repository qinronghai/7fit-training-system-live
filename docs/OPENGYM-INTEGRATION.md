# OpenGym 动作库接入说明

## 本次接入

7Fit 新增了一个独立的 `OpenGym 外部候选` 层，不修改现有正式动作、Anatomy、PREP 或 Resolver：

- `data/src/opengym.json` 保存 1,179 条可追溯的 ExerciseDB v1 元数据候选。
- 每条候选保留 OpenGym 永久 ID、身体部位、器械、目标/协同肌群、简介、执行步骤和 7Fit 器械/动作模式建议。
- 候选统一为 `待人工验收`，`autoCompileEligible=false`，只能在动作库搜索和详情抽屉中查看。
- `data/opengym-candidates.js` 是由脚本生成的静态浏览器 bundle，不是手工维护文件。

重新生成：

```bash
python3 tools/import_opengym_candidates.py /path/to/openGym
python3 tools/import_opengym_candidates.py /path/to/openGym --check
```

## 借鉴的设计

- 用稳定的外部动作 ID 保持历史可追溯，避免用名称作为主键。
- 以结构化字段支持按身体部位、器械、目标肌群、动作类别和模式检索。
- 动作详情使用“简介 + 执行步骤 + 肌群/器械事实 + 来源”而不是只显示一个图片卡片。
- 候选、正式、可编排三种状态分层；外部资料先发现，再经过教练审核转正。
- 媒体与动作文本分开管理，避免把媒体的许可误认为数据或代码的许可。

## 媒体许可闸门

本仓库**没有导入、复制、热链或重新编码** OpenGym/Gym visual 的图片和动画。候选详情只显示 7Fit 自有媒体的占位状态 `not-imported`。

OpenGym 的代码是 AGPL，但其动作媒体是单独的第三方内容；用于 7Fit 必须取得 Gym visual 针对 7Fit 项目的书面许可。获得许可后，也应将授权编号、允许的尺寸/渠道、到期日和文件哈希写入 7Fit 自己的媒体清单，再把媒体标记为 `gymvisual-licensed`。没有许可时，使用 7Fit 自己拍摄/绘制的照片、逐帧图或动画，并记录 `7fit-owned` 来源。

禁止用截图、裁剪、翻转、重编码、去署名、隐藏来源、CDN 热链或从 OpenGym 包/运行实例提取来绕过这个闸门。

## 来源

- [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)
- [OpenGym catalogue README](https://github.com/DuarteSantos8/openGym/blob/main/catalogue/README.md)
- [OpenGym third-party notices](https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md)
