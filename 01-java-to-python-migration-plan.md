# Java → Python 迁移计划

日期：2026-09-22  
主导岗位：项目经理 / Principal Software Architect  
状态：规划稿 v1  
目标目录：`/Users/zhousiyu/Documents/软件项目/户外推荐/户外推进（新）`

## 1. 目标与范围

### 1.1 目标

将当前 `outDoor/server/` 的 Java Spring Boot 后端，按业务域渐进迁移为 Python 后端，并为 Python Agent、Git Skill 和后续独立服务调用提供统一运行基础。

### 1.2 范围内

- Java Controller / Service / Repository 的业务边界盘点；
- Python API、Domain、Infrastructure、Agent Runtime 目标结构；
- API 契约与兼容策略；
- 业务域迁移顺序；
- Java / Python 并行阶段的所有权和回滚规则；
- 测试、观测和切换门禁；
- 新项目代码未来迁移到 `户外推进（新）/` 下的目标布局。

### 1.3 范围外

- 本轮不复制或重写代码；
- 本轮不决定具体 Python Web 框架的最终版本；
- 不立即删除 Java；
- 不立即迁移前端；
- 不把 Agent、MySQL 和 Java 迁移一次性合并为单个大改动；
- 不在没有数据备份的情况下切换正式数据。

## 2. 当前架构证据

当前 Java 后端位于：

```text
outDoor/server/src/main/java/com/outdoor/recommendation/
```

主要边界：

| 当前边界 | 代表代码 | 迁移含义 |
|---|---|---|
| 用户推荐 API | `api/user/*RecommendationController.java` | 需要保持前端可用，优先建立契约测试 |
| 用户贡献 | `UserRouteController`、`UserRouteContributionService` | 属于正式写入链路，后迁移 |
| 路线资产 | `AdminRouteAssetController`、`AdminRouteAssetService` | 依赖 MySQL SoT，后迁移 |
| 候选治理 | `AdminExternalDiscoveryService`、`AdminExploreDraftService` | 先保留 Java，后迁移 |
| 推荐核心 | `SearchRecommendationService`、`FamilyRouteRanker` | 迁移前必须固定结果和规则版本 |
| 地图增强 | `MapResultEnrichmentService`、`AmapClient` | 可由 Python Agent 编排，但正式能力需有唯一 owner |
| 持久化 | `repository/*` | 先完成 MySQL 迁移，再迁移语言实现 |

## 3. 目标目录结构

本轮不创建代码，仅锁定未来目标结构：

```text
户外推进（新）/
├── README.md
├── 01-java-to-python-migration-plan.md
├── 02-mysql-persistence-design-and-refactor-plan.md
├── 03-agent-product-design-and-refactor-plan.md
├── backend-python/
│   ├── app/
│   │   ├── api/
│   │   ├── application/
│   │   ├── domain/
│   │   │   ├── route_assets/
│   │   │   ├── recommendations/
│   │   │   ├── contributions/
│   │   │   ├── candidates/
│   │   │   └── agent_runtime/
│   │   ├── infrastructure/
│   │   │   ├── mysql/
│   │   │   ├── amap/
│   │   │   └── weather/
│   │   └── contracts/
│   ├── migrations/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── agent/
│   ├── api/
│   ├── orchestration/
│   ├── tools/
│   ├── policies/
│   ├── skills/
│   ├── providers/
│   └── tests/
└── infra/
    ├── local/
    ├── staging/
    └── deployment/
```

前端仍保留在现有目录，先通过稳定 API 连接新后端：

```text
miniprogram/       → Python API / 兼容 API
outDoor/client/    → Python API / 兼容 API
```

## 4. 目标分层

```text
API 层
  → Application Use Case
    → Domain Policy
      → Repository Port
        → MySQL / 外部 Provider Adapter
```

规则：

1. Domain 不依赖 FastAPI、ORM、LLM、供应商 SDK；
2. Agent 是应用编排能力，不是数据权威层；
3. Skill 通过 Tool Contract 接入，不直接获得数据库权限；
4. Repository 由 MySQL 实现，测试可替换为内存实现；
5. 前端只依赖公开契约，不依赖 Java 或 Python 实现细节。

## 5. 业务域迁移顺序

### 阶段 P0：迁移准备和边界锁定

任务：

- [ ] 清点现有 Java Controller、Service、Repository、DTO、测试；
- [ ] 建立 Java → Python 业务域映射表；
- [ ] 明确当前 Git 工作区哪些变更属于迁移前基线；
- [ ] 设计 Python 目标目录；
- [ ] 选定 API 契约格式和版本策略；
- [ ] 确定 Python 运行环境、依赖锁定和部署方式。

验收：

- 每个 Java 模块都有 owner、目标 Python 模块、迁移阶段；
- 没有“同时迁移全部模块”的 XL 任务；
- 前端 API 主契约列表完成。

### 阶段 P1：Python 基础运行骨架

任务：

- [ ] 建立 Python API 服务；
- [ ] 建立配置、日志、错误响应、健康检查；
- [ ] 建立 MySQL 连接和迁移工具入口；
- [ ] 建立契约测试框架；
- [ ] 建立可独立部署的 Dockerfile；
- [ ] 建立 Java / Python 运行时 feature flag。

验收：

- Python 服务可独立启动；
- `/health` 和版本信息可用；
- 无业务切换时不会影响现有 Java 服务。

### 阶段 P2：优先迁移 Agent 专属能力

任务：

- [ ] 迁移 Agent session、turn、tool call 运行记录；
- [ ] 建立 Python Agent API；
- [ ] 建立 Tool Registry；
- [ ] 建立模型 Provider Adapter；
- [ ] 建立 Skill Registry；
- [ ] 建立 Agent 失败回退。

验收：

- Agent 可独立调用；
- Java 仍保留正式推荐主链路；
- Agent 关闭时现有产品不受影响。

### 阶段 P3：迁移只读推荐查询

任务：

- [ ] Python 实现路线查询只读用例；
- [ ] Python 读取已完成迁移的 MySQL 路线资产；
- [ ] 与 Java 推荐结果做对照；
- [ ] 建立推荐结果差异报告；
- [ ] 先以灰度入口提供 Python 结果。

验收：

- 结构化结果与前端契约兼容；
- 路线状态、审核状态和可推荐标记一致；
- 结果差异可解释；
- Java 可作为回退。

### 阶段 P4：迁移地图、天气和外部信息编排

任务：

- [ ] Python 建立 Provider Port；
- [ ] 接入地图 / 天气适配器；
- [ ] 建立缓存、超时、重试、降级；
- [ ] 保持外部 Key 不进入 Agent Prompt 和日志；
- [ ] 记录外部调用量和失败率。

验收：

- 外部服务不可用时有明确降级；
- Agent 不直接依赖供应商 SDK；
- 不影响路线资产 SoT。

### 阶段 P5：按业务域迁移正式写入

推荐顺序：

```text
Agent 运行记录
→ 搜索事件
→ 推荐结果快照
→ 用户反馈 / 贡献
→ 候选治理
→ 路线资产
→ 后台设置与治理规则
```

每个业务域迁移必须单独具备：

- 数据 owner；
- 写入切换时间；
- 双写或一次切换策略；
- 回滚方案；
- 数据对账；
- QA；
- reviewer；
- 人工验收。

### 阶段 P6：Java 下线评估

只有满足以下条件才进入：

- Python 覆盖正式 API；
- Java 无正式写入职责；
- MySQL 数据一致性通过对账；
- 小程序和后台回归通过；
- Python 具备故障回退；
- 至少一个稳定运行周期；
- 已完成外部可验证备份；
- 用户确认允许停用或下线 Java。

## 6. API 兼容策略

### 6.1 外部 API

保持现有前端可用，优先采用：

```text
/api/user/*
/api/admin/*
```

迁移期间由 API Gateway 或 Python Compatibility API 承接。

### 6.2 内部 API

为 Agent 和未来服务调用建立版本化内部接口：

```text
/internal/v1/routes/search
/internal/v1/routes/{routeId}
/internal/v1/recommendations/preview
/internal/v1/map/enrichment
/internal/v1/risk/check
```

内部 API 不复用前端 DTO，不暴露数据库表结构。

## 7. 数据所有权规则

迁移期间每个业务域必须明确：

| 业务域 | 唯一正式写入方 |
|---|---|
| 路线资产 | 未完成迁移前为 Java；完成迁移后为 Python |
| 用户贡献 | 未完成迁移前为 Java；完成迁移后为 Python |
| 推荐结果 | 由当前被指定的推荐 owner 写入 |
| Agent 运行记录 | Python |
| Skill Registry | Python Agent 配置仓 |
| MySQL Schema | 数据迁移 owner，禁止服务自行修改 |

禁止 Java 和 Python 同时对同一业务域正式写入。

## 8. 验证和门禁

每个迁移切片需要：

- 单元测试；
- API 契约测试；
- 数据对账；
- 旧新结果差异报告；
- 异常和超时测试；
- 回滚演练；
- QA 报告；
- 执行后二次诊断；
- reviewer 报告；
- 总控人工验收判断。

推荐指标：

- API 成功率；
- P95 延迟；
- 结果差异率；
- 数据对账差异数；
- 回退触发率；
- Agent 工具失败率；
- 用户反馈负面率；
- Python 服务资源使用。

## 9. 主要风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 一次性重写 | 高 | 采用按域迁移和可回退切片 |
| 双写冲突 | 高 | 每个业务域只允许一个正式写 owner |
| API 语义漂移 | 高 | 先固定契约，再替换实现 |
| 推荐结果变化 | 高 | 固定规则版本、做新旧对照 |
| Python 依赖失控 | 中高 | 锁定依赖、镜像构建、SBOM / 审查 |
| 迁移打断 M1/M2 主线 | 高 | 先迁 Agent 和只读路径，保持旧链路可用 |

## 10. 计划授权边界

本文件只是迁移计划，不授权：

- 删除 Java；
- 修改生产数据库；
- 执行大规模数据迁移；
- 安装 Python / Java 新依赖；
- 部署或切换流量；
- Git commit / push。

## 11. 反向思考卡

- 当前身份：项目经理 / Principal Software Architect。
- 用户要求：制定 Java 迁移 Python 计划，并为新项目目录预留代码迁移结构。
- 客观判断：Python 作为目标架构可行，但一次性全量重写会叠加语言、数据和 Agent 三类风险。
- 阻塞项：MySQL SoT、业务域 owner、API 兼容契约尚未落地。
- 建议：先完成 P0/P1，再从 Agent 和只读推荐开始迁移。
- 是否建议下一步：建议进入 MySQL 设计与迁移前置检查，不建议直接复制或重写全部代码。

