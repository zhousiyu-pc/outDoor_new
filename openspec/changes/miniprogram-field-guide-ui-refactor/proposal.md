## Why

当前小程序前端仍使用高密度白色面板和统一青绿色组件，和已完成的 `outdoor-recommendation-exploration` 视觉探索存在明显断层。用户要求将小程序前端按探索方向重构，以形成一致的“quiet field guide / warm utility”体验，同时保留现有推荐、收藏、地图、反馈和降级能力。

## What Changes

- 将小程序公共背景、颜色、圆角、按钮和卡片层级转为米白纸张 / 深苔绿 / 赭石强调体系。
- 重构首页为情绪导向的发现入口，保留出发地、出发时间、快速诉求和高级筛选。
- 重构结果页为“先看理由，再做决定”的路线卡列表。
- 重构详情页为“是否适合现在出发”的决策页。
- 重构反馈页为轻量纸张表单。

## Capabilities

### New Capabilities

- `miniprogram-field-guide-ui`: 以探索页 UI 模式承载小程序首页、结果、详情和反馈页面。

### Modified Capabilities

- `miniprogram-runnable-baseline`: 保持既有页面路径、脚本依赖和本地 fallback 行为不变，更新其视觉承载。

## Impact

影响 `miniprogram/app.wxss`、四个页面的 WXML/WXSS 以及本 change 治理文档。原则上不修改 API 客户端、旅程状态、推荐数据和后端契约。不新增依赖、不修改数据库、不部署、不提交 Git。
