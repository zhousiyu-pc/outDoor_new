## Why

目标项目目前只有小程序壳和长期迁移规划，`app.json` 引用的页面与工具文件尚未落地，因此无法被微信开发者工具完整编译。现在先建立一个可运行、可验证且不依赖后端的基线，才能继续推进后续 Python、MySQL 和 Agent 阶段。

## What Changes

- 补齐小程序首页、结果页、计划详情页、反馈页及其样式和脚本。
- 补齐本地旅程状态、API 客户端和推荐降级数据工具。
- 增加微信开发者工具项目配置。
- 增加目标项目的治理索引、当前基线、追踪矩阵和执行锁。

## Capabilities

### New Capabilities

- `miniprogram-runnable-baseline`: 提供完整的小程序页面依赖和本地可验证运行基线。

### Modified Capabilities

- 无。

## Impact

影响 `miniprogram/`、项目根目录微信配置和 `docs/project-governance/`。不影响 Java、Python、MySQL、Agent、生产环境或第三方依赖。
