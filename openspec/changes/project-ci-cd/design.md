# CI/CD 设计

## Context

仓库同时包含 Java 服务、Python Agent、微信小程序和可选 portable 部署脚本。PR 阶段必须能在无生产凭据、无生产数据库、无真实 provider 的隔离环境中复现主要检查；部署阶段必须以已验证的不可变产物为身份，不能在服务器重新构建源码。

## Goals / Non-Goals

目标是把当前人工命令固化为可审计的 CI/CD 阶段、产物、权限和回滚契约，并明确哪些动作仍需人工批准。非目标是本轮直接部署服务器、上传小程序、配置真实 secrets、迁移生产数据库或自动开启生产发布。

## Decisions

1. PR 只读 CI 作为第一阶段：治理、Java、Python、Node、小程序契约和跨服务 smoke 必须通过；容器只构建不推送。
2. 合并后的候选镜像使用完整 commit SHA 与 OCI digest，部署只选择已验证 digest，禁止 `latest` 作为部署身份。
3. staging 使用手动 workflow 和独立测试资源；production 使用 protected environment、人工审批、备份、健康探针和显式回滚责任人。
4. 微信体验版/正式版发布与后端部署分离，继续由开发者工具、真机验收和平台审核完成。

## Risks / Trade-offs

- CI 绿灯只证明覆盖范围内的离线检查，不证明真实来源质量、微信原生体验或生产数据正确性。
- 只读阶段不能自动发现服务器配置漂移，因此 staging 仍需独立演练和发布证据。
- 镜像、SBOM 和扫描产物增加构建时间，但换来可追溯和可回滚的发布身份。

## 流程

```text
PR -> CI checks -> review/gates -> main
                               -> immutable images/SBOM
                               -> manual staging -> protected production approval
Mini Program: PR checks -> experience build/manual device acceptance -> WeChat manual release
```

## 服务分层

- Java：JDK 17/Maven 测试、镜像构建、健康和业务 API smoke。
- Python Agent：Python 3.12 锁定依赖、unittest/HTTP 边界、镜像构建和来源降级检查。
- Mini Program：Node 回归、JS/JSON/WXML/WXSS 静态检查；微信原生体验由人工设备验收。
- 数据库：staging 迁移/备份/恢复/回滚独立于应用发布，禁止应用 job 隐式修改生产 schema。

## 安全与回滚

- PR 不读取生产 secrets；生产凭据仅由 protected environment/secret store 注入。
- 镜像以 commit SHA/OCI digest 发布，禁止 `latest` 作为部署身份。
- 部署前保留旧 digest、配置和数据库备份；应用失败回滚镜像，数据库回滚走单独审批和恢复演练。
- 生产并发部署串行化，发布后以只读探针和关键指标决定继续、停止或回滚。

## 保留人工门禁

生产发布、小程序上传/审核、真实 provider、生产数据库变更、正式隐私资料和微信真机验收不由 PR CI 自动代签。

详细命令、阶段和当前限制见 `docs/project-governance/cicd-process.md`。
