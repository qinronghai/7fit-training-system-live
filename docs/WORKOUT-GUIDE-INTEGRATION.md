# Workout Guide 动作视觉接入

7Fit 目前接入的是 `bryllim/workout-guide` 的 22 条正式动作映射、21 个独立 source slug、每条 3 帧 SVG。素材复制到 `assets/workout-guide/` 后，在动作详情抽屉里以轻量 CSS 帧动画展示；浏览器禁用动效时只保留首帧。

## 来源与许可

- 项目：<https://github.com/bryllim/workout-guide>
- 视觉资产：CC BY-SA 4.0
- 源代码与文档：MIT
- 署名：Bryl Lim；部分原始姿态来自 Everkinetic：<https://github.com/everkinetic/data>
- 许可文本：<https://creativecommons.org/licenses/by-sa/4.0/>

SVG 按源文件原样复制，没有去署名或改色。若后续改动这些素材，派生版本仍须按 CC BY-SA 4.0 共享，并保留上述署名与来源。

## 重新导入

先将官方仓库克隆到临时目录，再运行：

```bash
python3 tools/import_workout_guide_assets.py /path/to/workout-guide
python3 tools/import_workout_guide_assets.py /path/to/workout-guide --check
```

正式动作与 source slug 的人工映射在 `tools/import_workout_guide_assets.py` 的 `ACTION_SLUGS` 中；不要根据中文名自动猜测动作视觉。`data/src/workout-guide-media.json` 是审计清单，`data/workout-guide-media.js` 是页面运行时 bundle。
