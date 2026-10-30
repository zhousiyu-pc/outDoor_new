# CI/CD 开发自测

更新时间：2026-10-29。范围仅为本地文档、治理脚本和只读 PR workflow；没有 Git commit/push、服务器部署、小程序上传、生产数据库操作或真实 secrets。

## 已执行命令

| 检查 | 结果 |
|---|---|
| `openspec validate project-ci-cd --strict --no-interactive` | PASS：Change `project-ci-cd` is valid |
| `python3 scripts/check-target-governance.py --project . --change project-ci-cd --json` | PASS：`ready=true`，无 missing/warnings |
| `python3 scripts/check-document-baseline.py --project .` | PASS：0 warnings |
| `python3 scripts/check_phase_one_docs.py` | PASS |
| `git diff --check` | PASS |
| workflow YAML 解析与 job 依赖静态检查 | PASS：6 个 job，container-build 依赖前置检查 |
| `mvn --batch-mode --no-transfer-progress -f backend-java/pom.xml verify` | PASS：66/66；本机 Java 24，尚未在 CI 配置的 Java 17 runner 验证 |
| Python 3.12 隔离环境 `RUN_AGENT_HTTP_TESTS=1 PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s agent-python/tests -v` | PASS：98/98 |
| `node --test miniprogram/tests/*.cjs` | PASS：83/83 |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/run_phase_one_smoke.py`（Python 3.12 隔离环境） | PASS：默认无来源、幂等、地图/投稿边界、H2 重启持久化和预览拒绝正式采纳 |

## 当前结论

首次独立代码审查发现失败传播、变更检测和 CLI 包名问题，修复后复审为 conditional_pass，见 `code-review.md`。独立 QA 已完成定向复测并给出 conditional PASS，见 `qa.md` 与 `qa-report.md`；GitHub 上的 required checks、分支保护、镜像仓库、SBOM/漏洞扫描、staging、生产 protected environment 和微信发布流程仍未启用或验证。CI 通过不表示今天的代码已经部署到生产，也不表示聊天页面或后台智能体已完成线上发布。

## 未覆盖证据

- 未在 GitHub runner 上执行 workflow，尤其未验证 CI 固定的 Java 17；也未验证 Actions 权限、缓存和 artifact 实际上传。
- 未执行 Docker 镜像推送、digest 部署、staging 健康检查或回滚。
- 未验证微信开发者工具/真机和平台审核。
- 未读取真实密钥、生产数据库或真实 provider 响应。
