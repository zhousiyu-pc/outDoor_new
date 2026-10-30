# 岗位契约

## Change / Module

`project-ci-cd`：为 Java、Python Agent、微信小程序和 portable 部署建立只读 PR CI、不可变构建产物、staging/production 门禁及人工发布边界。

## Global Goal

让每次候选版本都能从源提交追溯到测试、镜像 digest、部署证据和回滚路径，同时确保 CI 不能越过生产身份、数据库、隐私和微信真机门禁。

## Role Boundaries

| 岗位 | 负责 | 不代替 |
|---|---|---|
| tech-director | 阶段编排、启用判断、生产放行边界 | 不代替开发、QA 或 reviewer |
| architect | CI/CD 拓扑、产物、权限和回滚契约 | 不直接批准生产发布 |
| programmer | workflow、脚本和配置实现 | 不代签独立 QA/reviewer |
| code-reviewer | workflow 安全、权限、注入和回滚代码审查 | 不代替运行验收 |
| QA | CI、staging、探针和失败路径验证 | 不代替用户真机验收 |
| diagnostician | 执行后漂移、越权、证据完整性诊断 | 不代替 reviewer |
| reviewer | 独立终审和交付状态判断 | 不代替用户生产授权 |

## Stage Gates

1. 需求与架构：proposal、design、spec 和本契约明确范围、非目标和人工门禁。
2. 开发：workflow、锁定依赖、治理脚本和文档完成，并通过本地开发自测。
3. Code review：检查权限最小化、注入风险、secret 边界、镜像身份和回滚路径。
4. QA：独立执行 Java、Python、Node、跨服务 smoke、OpenSpec 和文档检查。
5. Post-execution diagnosis：判断执行漂移、治理缺口和证据完整性；触发时维护诊断状态。
6. Reviewer：仅在 code review、QA 和诊断证据齐备后给出本地交付结论。
7. 生产/微信发布：另行人工授权，不能由本 CI 自动触发。

## Evidence Requirements

- CI workflow、治理脚本和流程文档可在仓库内直接运行，不依赖开发机绝对路径。
- Java、Python、Node 和跨服务 smoke 的真实通过日志可留存为构建产物。
- Python 依赖使用 3.12 lockfile；容器构建不推送、不部署，生产 secrets 不进入 CI。
- 生产发布须另有 code-review、QA、diagnostician、reviewer、备份、健康探针和回滚证据；微信发布须有版本、上传人、真机验收和平台状态记录。

## Drift Risks

- 将 CI 通过误判为生产就绪。
- 使用 `latest` 或服务器现场构建导致产物不可追溯。
- 将 secrets、生产数据库或真实 provider 暴露给 PR job。
- 把小程序发布与后端发布绑定，或跳过真机、隐私和平台审核。

## KPI Recording Rules

- 只记录检查状态、构建耗时、失败类型、产物 digest、回滚次数和门禁状态；不记录密钥、完整用户输入、生产数据或 provider 原始响应。
- “继续”“可以”“允许”等流程放行词不自动生成 KPI。
- 若治理缺口、越权或返工由流程遗漏造成，记录为 KPI candidate，由 diagnostician 判断是否进入项目或全局 ledger。
