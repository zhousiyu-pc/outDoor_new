# CI/CD QA 报告

日期：2026-10-29。独立 QA 结论：**conditional PASS**。本地自动化覆盖范围内未发现阻塞；远程 runner 与发布环境证据缺失，不构成部署放行。

## 实际结果

| 检查 | 结果 |
|---|---|
| `python3 scripts/check-target-governance.py --project . --change project-ci-cd --json` | PASS：`ready=true`，无 missing/warnings |
| `openspec validate project-ci-cd --strict --no-interactive` | PASS |
| `python3 scripts/check-document-baseline.py --project .` | PASS：0 warnings |
| `python3 scripts/check_phase_one_docs.py` | PASS |
| `git diff --check` | PASS |
| Java `mvn ... verify` | PASS：66/66；本机 Java 24，不是 workflow Java 17 |
| Python 3.12 Agent unittest + HTTP | PASS：98/98；`pip check` PASS |
| Mini Program JS/JSON + Node tests | PASS：83/83，语法检查 PASS |
| 隔离跨服务 smoke | PASS：无来源、幂等冲突、投稿/地图降级、H2 重启、预览候选拒绝正式采纳 |
| workflow YAML/jobs/needs/权限/no-push | PASS |
| `false | tee` 在 GitHub Bash `-e -o pipefail` 模拟 | PASS：退出码 1 |
| PR/main diff 逻辑模拟 | PASS：多提交、archive 排除、删除跳过、全零 before 使用空树 |

## 未覆盖

未在 GitHub runner 实际运行 workflow，未验证 Java 17、Actions 权限、cache、artifact、Docker build、SBOM/漏洞扫描、required checks、分支保护、staging、生产 protected environment 或微信工具/真机。QA 结论不表示远程 CI 已运行，不表示代码已部署。

## 结论与后续

允许进入 reviewer 的条件性交付判断。若 workflow 再修改，需重新执行受影响的定向回归和 code-review；启用 required checks 或 staging 前必须补 GitHub runner 证据。
