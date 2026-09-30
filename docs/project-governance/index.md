# 项目治理索引

状态：active  
项目：户外推进（新）  
当前 change：`backend-implementation-architecture`

## 当前范围

本 change 以已评审小程序原型为输入，冻结后端 API、Java/Python/MySQL 边界、候选到正式路线资产的数据规则和实施分期。用户已要求继续，当前实施本地 B0/B1 切片与 Agent / 小程序适配，使用缓存依赖与隔离 H2 数据。真实数据库迁移、部署与生产同步不在本轮范围。

## 当前文档

- `current.md`：当前有效基线
- `backend-execution-baseline.md`：2026-09-29 本地实现授权、契约修正和反向思考
- `context/backend-implementation-handoff.md`：当前分工、验证与交接
- `product-requirements-framework.md`：项目级产品需求框架
- `product-phase-one-scope.md`：一期可靠路线参考范围
- `../../openspec/changes/miniprogram-single-sentence-input/`：一句话输入 UI 修正 change
- `../../openspec/changes/miniprogram-h5-demo-ui-translation/`：按已评审 H5 demo 转译四个小程序页面
- `../../openspec/changes/backend-implementation-architecture/`：按当前原型设计后端 API、服务边界、数据模型和实施分期
- `../architecture/backend-implementation-architecture.md`：后端实现与架构设计主文档
- `../../docs/product/phase-one-prd.md`：一期 PRD
- `../../docs/architecture/phase-one-microservice-architecture.md`：一期微服务架构
- `../../docs/design/phase-one-miniprogram-design.md`：一期小程序设计
- `../../docs/testing/phase-one-test-plan.md`：一期测试计划
- `data-source-and-recommendation-framework.md`：多来源信息与推荐框架
- `market-research-competitor-analysis.md`：市场与竞品调研
- `traceability-matrix.md`：需求到验证证据的追踪
- `context/current-context.md`：当前执行上下文
- `../01-java-to-python-migration-plan.md`：长期迁移计划
- `../02-mysql-persistence-design-and-refactor-plan.md`：持久化计划
- `../03-agent-product-design-and-refactor-plan.md`：Agent 计划

- `context/button-regression-handoff.md`：重复用户反馈的 native 按钮级联根因、修复范围和当前验收边界。
- 当前 change 的 `evidence/` 与 `kpi-events.md`：84 个编译产物回归及验证不足的本地 KPI 候选；整体原生 UI 验收保持未完成。
