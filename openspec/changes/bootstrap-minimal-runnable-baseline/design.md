## Context

目标项目是规划阶段的新目录，原有 `miniprogram/app.json` 已声明四个页面，但页面实现和工具模块缺失。参考项目 `/Users/zhousiyu/Documents/软件项目/户外推荐/miniprogram` 已包含同一产品的可用实现。

## Goals / Non-Goals

**Goals:**

- 复用参考项目的小程序实现，恢复完整页面依赖。
- 保持现有页面路径和云容器调用契约。
- 在不安装依赖、不连接数据库的情况下形成可验证基线。

**Non-Goals:**

- 不迁移 Java 后端。
- 不建立 MySQL Schema 或导入数据。
- 不建设 Python Agent。
- 不修改生产配置或提交 Git。

## Decisions

1. 采用参考项目同路径文件作为实现来源，因为目标项目文档明确要求参考该项目，且页面契约已经存在。
2. 保留本地推荐降级数据，不新增第三方依赖，以确保远端服务不可用时核心页面仍可展示。
3. 使用根目录 `project.config.json` 指向 `miniprogram/`，满足微信开发者工具项目识别。

备选方案是从空白重新实现页面，但会扩大范围并重新引入交互风险，本轮不采用。

## Risks / Trade-offs

- [参考项目与目标规划未来演进不同步] → 记录来源和范围，后续 Python/Agent 切片再单独建立契约。
- [真实云容器服务可能不可用] → 依赖本地 fallback；真实接口回归留到 QA 环境。
- [复用实现包含生产环境标识] → 本轮只保留已有配置，不进行生产同步；后续需单独做配置治理。

## Migration Plan

先补齐文件并执行静态检查；后续阶段再以稳定 API 契约接入 Python 或兼容后端。失败时可删除本 change 新增文件，不触碰原有后端和数据库。

## Open Questions

- Python API 的最终框架和 MySQL 版本仍由后续架构阶段决定。
