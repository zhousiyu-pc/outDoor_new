# CI/CD QA 计划与执行记录

日期：2026-10-29。测试对象为修复后的 `.github/workflows/ci.yml` 和 `project-ci-cd` 治理契约；不执行 GitHub 推送、部署或小程序上传。

## 覆盖

1. 治理、OpenSpec、文档基线、一期文档和 diff check。
2. Java Maven、Python 3.12 Agent、Mini Program Node/JS/JSON、隔离跨服务 smoke。
3. workflow YAML、job 依赖、只读权限、无推送构建和四个 `tee` 步骤的失败传播。
4. PR base/main before 到 checkout SHA 的多提交、归档、删除和全零 SHA 差异选择逻辑。

## 环境与限制

- Python 3.12.8：`/private/tmp/outdoor-cicd-agent-venv312`。
- Node 20.20.2；Java 本机 24.0.2；workflow 目标 Java 17。
- 本机 Bash 3.2 不支持 `mapfile`，因此 workflow 整段未在本机执行；GitHub runner、Actions cache/artifact、Docker build、required checks 和分支保护未验证。

## 通过标准

所有本地命令和定向逻辑检查通过；未覆盖项必须单独列出，不能把 conditional PASS 写成远程 CI 或生产发布通过。
