# 野去 · 户外路线推荐

当前版本以已确认的小程序原型为基础，正在实现 B0/B1 后端契约和本地业务闭环。Java 是业务与数据库唯一写入入口，Python Agent 负责返回带来源证据的候选。当前可进行本地联调，尚未完成生产交付。

```text
微信小程序 → Java Spring Boot API → JDBC（本地 H2；目标 MySQL）
                         ↓
                  Python Agent → 来源 Connector（待真实接入）
```

## 目录与入口

| 目录 | 当前职责 |
| --- | --- |
| `miniprogram/` | 首页、搜索结果、路线详情、纠错和补充路线 |
| `outdoor-recommendation-exploration/` | 已确认的静态 H5 视觉原型 |
| `backend-java/` | Java 17 目标字节码、Spring Boot、JDBC、幂等事务和业务校验 |
| `agent-python/` | Python 3.10+ 标准库内部服务、候选规范、来源与演示隔离 |
| `database/mysql/` | MySQL 设计及迁移草案，尚未执行 |
| `scripts/` | 本地联调、文档及基线检查 |
| `docs/`、`openspec/` | 当前需求、架构、任务和验收证据 |

用微信开发者工具打开仓库根目录，`project.config.json` 的小程序目录为 `miniprogram/`。H5 原型可在仓库根目录运行：

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory outdoor-recommendation-exploration
```

打开 <http://127.0.0.1:4173/>。H5 是视觉原型，不代表真实来源已经接入。

## 本地验证

需要本机已有 Java、Maven、Python 和 Node，以及已经缓存的 Maven 依赖；下列构建使用离线模式，不安装或下载依赖。若缓存不齐全，构建会失败，应先单独处理依赖授权。

```bash
mvn -o -f backend-java/pom.xml package
node --test miniprogram/tests/backend-contract.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s agent-python/tests -v
python3 scripts/run_phase_one_smoke.py --skip-build
```

不带 `--skip-build` 的 smoke 命令会先运行同一条离线 Maven package。`--skip-build` 只适用于刚由当前代码构建且已经验证的 `backend-java/target/outdoor-business-0.1.0.jar`，不会检查 JAR 是否过期。

smoke 脚本仅启动自身的 Java/Python 进程，绑定动态 loopback 端口，在临时目录创建新的 H2 文件数据库，并生成临时内部服务令牌。它不连接已有数据库，不执行 MySQL 迁移；结束或收到中断时关闭自身进程、删除临时数据库。受限环境需要允许绑定本地端口。

脚本验证以下行为：

- 未配置来源时返回真实空结果，不伪造路线；
- 同一请求的幂等重试返回相同结果，不同请求复用键返回 409；
- 最小路线投稿进入待审核，地图未接入时明确降级；
- Java 重启后仍能重放已保存的搜索和投稿；
- 显式演示模式产生标注的预览候选，详情可冷启动读取，正式采纳被拒绝。

真实证据 fixture 的采纳、并发事务、反馈、事件和输入边界由 Java 测试覆盖；fixture 不表示已经接入真实路线来源。

## 本地持续运行

独立运行步骤与环境变量见 [Java 说明](backend-java/README.md) 和 [Agent 说明](agent-python/README.md)。Java 默认 `local` profile 只绑定 `127.0.0.1`，H2 数据文件位于进程工作目录下的 `runtime-data/`；可用 `LOCAL_DB_URL` 指向专用本地测试目录。

`AGENT_BASE_URL` 指向 Python 服务；如 Agent 配置 `AGENT_INTERNAL_TOKEN`，Java 的 `AGENT_SERVICE_TOKEN` 必须匹配。临时 smoke 自动生成二者，不读取或打印正式密钥。

小程序保留现有 `wx.cloud.callContainer` 调用方式，尚未把本地实现同步到云端。显式设置 `getApp().globalData.apiBaseUrl` 可将开发工具请求转到可达的本地 Java 地址；真机的 `127.0.0.1` 指向手机自身。开发工具域名校验及真机网络可达性需要单独检查。

默认没有真实地图或攻略 Connector，搜索可能为空，地图反向地理编码返回 `DEGRADED`。演示需同时显式启用 Python `AGENT_DEMO_MODE=true` 与小程序 `globalData.previewMode=true`；客户端发布版禁止演示数据。预览路线不能创建正式资产。搜索请求默认预算 5 秒，可通过 `globalData.searchDeadlineMs` 设置。

## 当前能力与边界

业务 API 使用 `/api/v1`，保存搜索请求、候选及证据、结果快照、采纳、反馈、投稿和事件。所有 POST 携带会话及幂等键；收藏保存在本机，独立于正式路线采纳。详情从服务端读取；反馈或投稿失败只保留本地草稿，不显示“已收到”。用户投稿进入 `REVIEW_PENDING`，不会自动公开。

匿名会话用于本地归属和幂等，并非经过验证的身份。当前 Java `production` profile 会拒绝启动；MySQL profile 也要求明确声明专用测试数据库。不得通过绕过这些启动限制发布生产。

尚未完成：真实来源授权与接入、生产身份认证和访问控制、真实 MySQL 迁移与回滚验证、生产限流与观测、镜像构建及云部署验收。H2 测试通过不等于 MySQL 或真实路线质量已验收。依赖安装、数据库变更、Git 提交和部署仍按项目门禁单独确认。

## 设计依据

- [后端实现与架构设计](docs/architecture/backend-implementation-architecture.md)
- [实施任务清单](openspec/changes/backend-implementation-architecture/tasks.md)
- [项目治理入口](docs/project-governance/index.md)
- [微信云托管准备](infra/wx-cloudrun/README.md)

根目录早期迁移分析文档保留为背景材料；当前实施以本次后端设计与 OpenSpec 为准。
