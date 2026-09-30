# 后端架构设计交付

更新：2026-09-29。本文区分目标架构与本地实现，不构成独立门禁结论。

## 选定方案与当前落地

- Java 是小程序唯一业务入口和事务拥有者。当前采用 Java 17 目标、Spring Boot 3.2.5、Jackson、JDBC 和统一幂等事务，旧标准库入口已转发到新应用。
- Python 仍使用标准库 HTTP 与显式契约校验，未使用 FastAPI；只处理推荐必要条件，不连接数据库。匿名会话和幂等键停留在 Java。
- 生产存储目标是 MySQL；当前 `local` profile 使用 H2 文件库和 `schema-local.sql`。MySQL profile 禁止自动初始化，迁移草案面向全新专用库，不是旧 schema 的增量升级。
- 外部来源必须通过受控 Connector 并附带证据。当前无真实 provider，正常返回 `NO_SEARCH_RESULTS`；调用失败或超时返回 `DEGRADED`。显式 demo 标记 `LOCAL_PREVIEW/MOCK/previewOnly:true`，不可进入正式资产。
- 生产目标保持 Java + Python + MySQL；真实来源、MySQL 执行与回滚、身份认证和生产部署 pending。

## 关键取舍

1. 客户端搜索总预算默认 5 秒，Java 等待 Agent 1.2 秒，Python Connector 总预算 1 秒。其他客户端请求默认 12 秒。异步刷新、生产排序和正式资产回退尚未实现。
2. 采纳、业务状态历史和幂等响应在同一事务提交。幂等范围为 `(session, operation, key)`；同键同体复用原结果，同作用域异体返回 `409 IDEMPOTENCY_CONFLICT`。候选及候选/会话唯一约束同时防止不同 key 重复创建。
3. 候选和资产详情分别使用 `GET /api/v1/user/candidates/{id}` 与 `/api/v1/user/routes/{id}`。旧推荐详情与 `/api/user/...` 等仅作兼容别名，共享业务规则。
4. 候选反馈必须匹配原 request/session；公开正式资产允许查看者反馈，不能把原搜索 ID 当成查看者拥有该搜索的依据。反馈只新增 `RECEIVED` 记录。
5. 投稿最少需要 `title/startPoint`，终点、备注、标签与分享意愿可选；状态为 `REVIEW_PENDING`，不自动发布或创建正式路线。
6. 本地会话用于归属和幂等，不是认证身份。Java production profile 拒启动；mysql profile 只允许明确确认的测试库。Python production 要求内部 token 且禁止 demo。

## 设计前问题与剩余边界

设计前 Java 的正则 JSON、JSONL 存根、条件丢失和客户端逐路径 POST 重试是本次改造原因，不能再写作当前实现。当前使用结构化 JSON、Repository、同路径稳定 key 重试；本地事务验证不替代 MySQL 隔离级别、锁、迁移和回滚验证。

真实来源的授权、更新频率、证据质量、排序与地图 provider 仍未接入。当前反向地理编码明确返回 `DEGRADED/label/provider:null`。生产身份、全局防滥用与部署验收仍待后续阶段；本文不提前勾选 tasks 或宣布 code-review、QA、诊断、reviewer 通过。

反向思考：保留本地可验证实现能够推进接口闭环，但如果把 H2 兼容模式或 demo 当作真实 MySQL/真实路线验收，会产生错误放行。阶段交接必须同时列明已实现边界与 pending 项。

详细设计见 `docs/architecture/backend-implementation-architecture.md`。
