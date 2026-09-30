## Why

一期产品已收敛为“用户一句诉求 → 多来源候选路线 → 用户采纳 → 正式路线资产”。现有项目只有小程序前端和规划文档，缺少支撑该闭环的 Java 业务服务、Python Agent、MySQL schema、Docker 部署准备和测试证据。

## What Changes

- 新增 Java Business API 最小微服务，负责推荐候选和采纳落地业务语义。
- 新增 Python Agent Service 最小微服务，负责一句诉求理解和受控多来源候选生成。
- 新增 MySQL schema 草案，表达候选、来源、采纳和正式资产关系。
- 调整小程序结果页，增加明确采纳路线动作。
- 增加 Dockerfile、文档和本地 smoke 验证脚本。

## Capabilities

### New Capabilities
- `phase-one-reliable-route-reference`: 一句诉求生成候选路线，用户采纳后正式落地。

### Modified Capabilities
- `miniprogram-runnable-baseline`: 小程序结果卡增加采纳动作和候选语义。

## Impact

影响 `backend-java/`、`agent-python/`、`database/mysql/`、`miniprogram/`、`docs/`、`scripts/` 和 `infra/`。不执行依赖安装、不连接真实数据库、不部署、不 Git 提交。
