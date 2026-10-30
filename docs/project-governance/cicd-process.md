# 项目 CI/CD 流程 v1

状态：流程已定义，自动化尚未启用。本文是目标流程，不代表仓库已有 CI 工作流、生产发布授权或系统已经 `productionReady`。

## 当前基线

- GitHub 远程为 `zhousiyu-pc/outDoor_new`；`.github/workflows/ci.yml` 已落盘为只读 PR/main CI，覆盖治理、Java、Python Agent、小程序、跨服务 smoke 和无推送容器构建，但尚未在 GitHub 上验证或配置为 required check，也没有部署权限或发布 workflow。
- 本地已复跑 Java Maven（66）、Python Agent（98）、小程序 Node（83）和隔离跨服务 smoke；尚未在 GitHub runner 验证。CI 预期 Java 17，而本机当前验证使用 Java 24。
- `infra/portable/compose.yaml`、预检/备份/恢复脚本支持人工服务器部署；2026-10-28 的 Agent/Java 更新也是人工备份、构建、切换和线上验证。
- 小程序上传仍需微信开发者工具流程；今天的聊天 UI 改造尚未上传。
- Java 的生产启动保护和整体 `productionReady=false` 必须保留，CI/CD 不得绕过。

## 目标架构

```text
Pull Request -> 自动 CI -> review/门禁 -> merge main
                                     |
                                     v
                         构建不可变镜像 + SBOM
                                     |
                         手动 staging 部署/回归
                                     |
                  生产 protected environment 审批
                                     |
                   digest 部署 -> 探针 -> 监控/回滚

小程序：PR 静态检查 -> 体验版人工上传/真机验收 -> 微信平台人工审核/发布
```

## 触发和分支规则

1. 功能分支使用 `codex/` 或 `feature/`，修复分支使用 `fix/`；禁止直接向 `main` 推送日常改动。
2. PR 创建、更新、重新打开时触发 CI；CI 不连接生产、不使用真实密钥、不写业务数据。
3. 合并 `main` 后可自动构建带 commit SHA 的候选镜像；在仓库权限、镜像仓库和 secret store 就绪前只保留构建产物，不部署生产。
4. staging 用手动 workflow dispatch；production 必须使用受保护环境和人工审批，不能因合并 `main` 自动上线。
5. 小程序体验版和正式版发布与后端部署分离，不能共用一个自动发布开关。

## PR CI 必检项

| 检查 | 目标命令/方式 | 门禁边界 |
|---|---|---|
| 差异、文档、治理 | `git diff --check`、OpenSpec strict、文档基线、目标治理 | 脚本必须固定版本并可在 CI 运行，不能依赖开发机绝对路径 |
| Java | JDK 17 + `mvn -B -ntp -f backend-java/pom.xml verify` | 使用 H2/测试 profile，不连接生产 MySQL |
| Python Agent | Python 3.12 隔离环境；`RUN_AGENT_HTTP_TESTS=1 PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s agent-python/tests -v` | 先修复当前依赖兼容问题并锁定版本/哈希；不读取真实 `.env` |
| 小程序 | `node --test miniprogram/tests/*.cjs`、JS/JSON 语法检查 | 静态通过不代替微信键盘、picker、安全区和真机验收 |
| 跨服务 | `scripts/run_phase_one_smoke.py` 或独立 fixture | 仅使用 job 自建进程、临时 H2、临时 token 和 loopback 端口 |
| 容器 | Java/Agent 分别构建、漏洞扫描、生成 SBOM | PR 阶段不推生产标签、不部署 |

CI 的测试输出不得包含生产密钥、数据库备份、用户资料或真实 provider 响应。基础镜像、依赖和微信编译工具必须固定版本；缓存只能加速，不能成为隐含依赖。

## 产物与发布身份

- Java、Agent 镜像使用完整 commit SHA 和 OCI digest 标记，禁止以 `latest` 作为部署身份。
- 发布清单记录源提交、镜像 digest、构建 run、测试结果、配置版本、迁移版本和回滚 digest。
- 密钥只进入 GitHub protected environment 或服务器 secret store，不打入镜像、仓库、日志或构建产物。
- 发布 job 使用最小权限并串行化；同一环境不允许两个发布同时执行。

## Staging 部署

1. 仅部署已通过 PR CI 的 digest，使用独立域名、测试凭据和独立测试 MySQL。
2. 部署前保存当前 digest、配置版本和数据库备份；服务器不重新拉源码构建。
3. 执行健康检查、Agent 鉴权、搜索/快照/详情闭环、后台登录与降级回归；不创建生产业务记录。
4. 应用失败回滚到上一组 Java/Agent digest。数据库迁移单独审批，必须先完成备份、恢复和兼容性演练；应用回滚不能假定能回滚数据库。

## Production 部署

当前生产发布继续人工执行。只有在以下条件满足后，才评估把“已批准 digest 部署”接入受保护的手动 workflow：

- 正式身份认证、访问控制、限流、审计、告警和 `productionReady` 门禁完成；不允许为让流水线通过而关闭启动保护。
- MySQL 迁移、升级、备份恢复和回滚在专用 staging 完成演练；生产 schema 变更另走数据库审批。
- 独立 code-review、QA、post-execution diagnosis、reviewer 和技术总监放行均完成；需要用户确认的生产操作仍需明确授权。
- 发布前备份、前一镜像 digest、健康探针和回滚负责人已确认。
- 发布后只读探针验证服务、搜索、详情、登录和核心指标；错误率、时延或核心路径异常时停止扩大发布并回滚。

## 小程序发布

- PR CI 只做 Node/JS/JSON 和可固定版本的 WXML/WXSS 编译检查。
- staging 由开发者工具上传体验版，使用测试环境和测试账号完成键盘、picker、安全区、TabBar、触控、搜索、详情和足迹验收。
- production 需隐私/运营资料闭环、体验版验收和平台审核后，由发布负责人手动上传并提交微信审核/发布；记录版本号、提交人、审核状态、发布时间和回退方式。
- 当前没有微信上传 CI，也未授权引入上传凭据或自动提交平台审核。

## 分阶段实施

1. **阶段 0：人工可重复**：Python 3.12 依赖已锁定并通过隔离测试；测试入口、备份和回滚清单已整理。
2. **阶段 1：只读 PR CI（工作流已落盘，待 GitHub 验证和启用）**：运行文档、Java、Python、小程序和隔离 smoke；不推镜像、不部署、不上传小程序。
3. **阶段 2：构建产物**：配置私有镜像仓库和最小权限，合并 `main` 自动构建 SHA 镜像、SBOM 和扫描报告；不自动生产部署。
4. **阶段 3：staging CD**：配置独立 staging、测试库和 secret store，启用手动部署、自动回归和 digest 回滚。
5. **阶段 4：受控生产 CD**：整体生产门禁解除后，再启用 protected environment 审批部署；数据库变更和微信发布仍单独审批。

## 反向思考卡

- 自动化能减少漏测和版本不一致，但不能把本地通过变成生产就绪。
- 当前 Python 依赖存在环境兼容风险，主分支工作区还有大量未提交改动，正式身份、MySQL 回滚和真机验收也未完成；现在自动部署会放大这些风险。
- CI 绿灯只证明覆盖范围内的检查，不证明真实来源质量、隐私合规、微信原生体验或业务数据正确性。
- 决策：先做只读 PR CI；依赖、分支保护和 staging 未就绪前不启用自动部署；生产与微信正式发布保持人工审批。

## 启用前待办

- [ ] 确认 GitHub Actions、仓库权限和 `main` 分支保护维护人。
- [x] 将文档基线/目标治理脚本固定版本并纳入仓库可运行范围；CI 使用 `scripts/check-document-baseline.py` 与 `scripts/check-target-governance.py`。
- [x] 修复 Python 依赖组合，生成并验证 Python 3.12 lockfile；后续可补充包哈希和漏洞扫描策略。
- [ ] 固定 WXML/WXSS 编译工具的版本、来源和许可边界。
- [ ] 确认私有镜像仓库、staging、secret store、备份恢复和发布责任人。
- [ ] 在 GitHub 启用并验证阶段 1 required checks 后，由技术总监复核，再评估 staging CD；生产和微信发布 workflow 另行评审。
