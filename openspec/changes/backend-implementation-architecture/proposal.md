# 后端实现与架构设计提案

更新：2026-09-29；本地 B0/B1 实现对照，独立门禁待评审。

## Why

小程序原型已稳定为“输入诉求 → 结果参考 → 详情 / 地图 → 加入 → 纠错或补充路线”的闭环。2026-09-28 设计前的 Java/Python 骨架只有搜索、采纳和事件占位，缺少完整条件、详情与反馈等契约及业务持久化。这是本 change 的起点，不代表当前源码仍处于旧状态。

## What changes

- 定义与原型一致的请求、候选/资产分离详情、采纳、反馈、投稿、事件、地图及错误契约。
- 本地 Java 已采用 Spring Boot、Jackson、JDBC 和 H2 事务；MySQL profile 与新库 schema 草案已提供，真实 MySQL 执行及回滚待验证。
- Python 保留标准库契约实现，提供条件解析、来源选择、证据校验、去重和 1 秒预算；未配置真实来源时返回正常空结果，失败才降级，demo 不可采纳。
- 客户端搜索预算默认 5 秒，Java 等待 Agent 1.2 秒；写请求使用 `(session, operation, key)` 幂等和同路径重试。
- 候选反馈核对原 request/session，公开资产反馈允许查看者提交；投稿以 `title/startPoint` 为最小输入，进入待审核状态。
- 继续保留 B0 契约、B1 持久化、B2 真实 Agent 来源、B3 治理和 B4 部署验收的顺序，不以文档更新替代专业门禁。

## Non-goals

- 本轮文档更新不安装或联网拉取依赖，不执行 MySQL migration、生产数据库变更、部署或生产同步。
- 不接入未经授权的平台，不做真实批量抓取，不把 demo 声称为真实来源。
- 不扩展天气、专业导航、社交、复杂推荐算法或完整账号体系；可信身份仍是生产前置待办。
- 保持已确认 UI 风格；客户端仅按后端闭环修正契约、预算与状态处理。
- 不提前勾选 tasks，不宣布 code-review、QA、诊断或 reviewer 放行。

## Scope boundary

事实来源为 `miniprogram/utils/apiClient.js`、四页 JS、`backend-java/` Spring Boot/JDBC 代码与 H2 schema、`agent-python/` 标准库代码、`database/mysql/migrations/V001__business_baseline_draft.sql` 及 PRD。旧 `phase_one_schema.sql` 保留为历史基线，新草案不能直接当作其增量迁移。

本地实现供独立审查和回归；B2 真实 provider、生产排序、MySQL 迁移/回滚、身份认证与生产部署均 pending。详细方案见 `docs/architecture/backend-implementation-architecture.md`。
