# 2026-09-29 后端实现交接

当前 change：backend-implementation-architecture；文档驱动 required。

用户已同意架构并要求继续。本轮交付本地可运行的 B0/B1 切片以及 Agent/小程序契约适配。执行与反向思考见 `docs/project-governance/backend-execution-baseline.md`。

分工：business_backend 写 backend-java 与 database/mysql；agent_contract 写 agent-python；client_contract 写小程序 JS 与测试。根代理协调契约、集成、文档和门禁，接着派独立 code-reviewer → QA → diagnostician → reviewer。

依赖策略：Spring Boot 3.2.5、Jackson/JDBC、MySQL 驱动和 H2 在本机缓存，离线构建。Python 当前未缓存 FastAPI，本片使用标准库实现同一内部契约，不阻塞 Java 业务闭环。

接口要点：POST 附带 session 与幂等键；搜索同时兼容旧扁平与新嵌套条件；GET candidates / routes 返回 plan；POST route-feedback 支持候选或资产；route-submissions 保留 shareExperience 布尔及 REVIEW_PENDING 状态。mock 源显式 previewOnly 且禁止正式采纳。

数据库与生产边界：H2 测试不连接现有 MySQL；迁移 SQL 是草案；本轮不部署到小程序配置中的现有云服务。完成状态和验证证据待下游门禁回填。
