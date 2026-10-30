# 项目 CI/CD 流程

## Why

项目需要一条可重复、可追溯、可回滚的交付链路，避免今天的聊天页面、后台智能体和后端改动只停留在本地工作区而无法证明是否可发布。当前测试、Docker 构建、服务器发布和小程序上传仍由人工执行，版本与证据容易漂移。

## What Changes

- 增加只读 PR CI，统一运行 OpenSpec、项目治理、Java、Python Agent、小程序和跨服务 smoke 检查。
- 固定 Python 3.12 依赖与跨服务隔离验证，保留 Java/Agent 无推送容器构建及日志产物。
- 定义合并后的不可变镜像、staging 手动部署、生产受保护审批、备份/健康检查/回滚和微信小程序人工发布边界。
- 将生产发布、真实 provider、生产数据库、隐私资料和微信真机验收继续放在人工门禁内。

## Impact

改动覆盖 `.github/workflows/ci.yml`、项目内治理脚本、Python 依赖锁定、Java/Agent 构建说明和 `docs/project-governance/cicd-process.md`。本 change 只落地本地流程、文档和只读 CI，不写生产数据、不配置真实 secrets、不上传小程序、不部署服务器。

## 文档驱动入口

`required`。本 change 涉及跨 Java、Python、微信小程序、镜像构建、服务器部署和生产门禁，不能只靠聊天约定。

## 目标

建立可重复、可追溯、可回滚的 CI/CD 流程：PR 自动验证，合并后生成不可变候选产物，staging 受控部署，生产和微信发布保留人工审批。

## 当前问题

- 仓库没有 GitHub Actions 或其他自动化流水线。
- 测试、Docker 构建、服务器发布和小程序上传由人工执行，版本与证据容易漂移。
- 当前 Python 依赖组合存在环境兼容失败；生产身份、MySQL 回滚、微信真机和隐私发布门禁尚未完成。

## 范围

- PR CI 检查、依赖/工具复现性、Docker 镜像和 SBOM 产物规则。
- staging 部署、健康检查、回滚和发布证据。
- 生产服务器受保护审批和微信小程序人工发布边界。
- GitHub secrets、镜像仓库和最小权限要求。

## 非目标

- 本 change 不直接部署服务器、不上传小程序、不读取或迁移真实数据、不配置真实密钥。
- 不绕过现有 `productionReady=false`、身份认证、隐私和数据库门禁。
- 不把 CI 通过等同于真实来源质量、微信真机验收或正式生产就绪。

## 验收标准

1. 有一份与仓库实际命令一致的 CI/CD 流程文档和岗位边界。
2. PR CI 的必检项、凭据边界、产物身份、staging/production 发布和回滚规则明确。
3. 当前缺口和分阶段启用条件可由下一轮 programmer 实现，不会自动触发生产。
4. 在 Python 依赖、分支保护和 staging 条件未完成前，不创建生产部署 workflow。
