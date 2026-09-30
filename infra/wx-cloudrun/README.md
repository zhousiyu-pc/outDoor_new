# 微信云托管准备草案

当前仅提供 Spring Boot JAR 的镜像打包配置，尚未构建镜像或部署。Java `production` profile 明确拒绝启动，匿名会话尚不能作为生产身份认证；真实来源、正式 MySQL 和生产验收门禁完成前禁止发布，也不能通过改 profile 绕过限制。

## 打包约定

先从仓库根目录使用现有缓存构建：

```bash
mvn -o -f backend-java/pom.xml package
```

产物是 `backend-java/target/outdoor-business-0.1.0.jar`。本目录 Dockerfile 与 `backend-java/Dockerfile` 使用相同的 Java 17 JRE、Boot JAR 入口及容器端口 `18080`；差异仅在构建上下文：前者为仓库根目录，后者为 `backend-java/`。不再使用独立 `javac` 编译旧入口。

未来经授权构建镜像时，从仓库根目录指定 `-f infra/wx-cloudrun/Dockerfile` 和根目录上下文。基础镜像可能需要联网拉取；本文不执行镜像构建或拉取。

## 后续环境配置

| 配置 | 用途及边界 |
| --- | --- |
| `PORT` | Dockerfile 默认 `18080`，云服务监听端口应一致 |
| `BIND_ADDRESS` | Dockerfile 设置 `0.0.0.0` 供容器转发；本地裸进程默认 loopback |
| `AGENT_BASE_URL` | 必须指定独立 Agent 的内部服务地址，跨容器不能使用 Java 自身的 loopback |
| `AGENT_SERVICE_TOKEN` | Java 调用 Agent 的令牌，与 Agent 的 `AGENT_INTERNAL_TOKEN` 匹配；安全注入，禁止写入镜像或仓库 |
| `SPRING_PROFILES_ACTIVE` | 当前仅本地或经明确授权的测试环境；`production` 会阻断启动 |
| `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` | MySQL profile 的测试连接配置，未执行建表或迁移 |
| `LOCAL_DB_URL` | 仅用于独立本地 H2 测试；不是云端生产数据库方案 |

MySQL profile 还需要 `APP_ALLOW_UNAUTHENTICATED_TEST_DATABASE=true`，含义是明确承认连接专用非生产测试库，不能作为上线开关。MySQL 自动建表关闭；迁移草案针对独立新库，已有数据库必须另做升级、备份和回滚方案。

Agent 应部署为内部服务，配置 `APP_ENV=production` 时要求内部令牌并禁止 `AGENT_DEMO_MODE=true`。这项内部服务校验不替代 Java 面向用户的生产身份与权限治理。

小程序继续使用 `wx.cloud.callContainer`；`X-WX-SERVICE`、云环境 ID 和业务 API 服务需要在部署验收阶段确认。此次没有改动既有云环境或同步服务。

## 上线前尚需完成

真实 provider 接入与来源许可、身份认证和访问控制、正式 MySQL 迁移与回滚演练、网关及分布式限流、健康检查/日志/指标、Java 17 运行时和微信真机验收。`/health` 返回 `productionReady:false`；本地 H2 的通过结论不能作为这些门禁的替代。
