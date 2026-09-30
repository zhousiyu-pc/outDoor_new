# Python Agent Service

当前实现是 B0/B1 的内部契约与来源隔离基础，使用 Python 3.10+ 标准库。Agent 只返回候选，不读写数据库，不创建正式路线。当前没有配置真实来源 Connector，默认返回空结果，不生成外部平台的假路线。

## 运行

在仓库根目录运行：

```bash
PORT=19081 python3 agent-python/app/server.py
```

本地默认只绑定 `127.0.0.1`。本地预览必须显式开启：

```bash
AGENT_DEMO_MODE=true PORT=19081 python3 agent-python/app/server.py
```

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | Dockerfile 显式设置 `0.0.0.0` |
| `PORT` | `19081` | 服务端口 |
| `APP_ENV` | `development` | Dockerfile 设置 `production` |
| `AGENT_INTERNAL_TOKEN` | 空 | 设置后所有候选请求必须使用 `Authorization: Bearer <token>`；production/prod 必填 |
| `AGENT_DEMO_MODE` | `false` | 只有显式 `true` 才返回演示路线，production/prod 禁止开启 |
| `AGENT_DEADLINE_MS` | `1000` | Connector 总预算，整数 1–10000；Java 调用超时需略大于此值 |

不要把真实 token 写入 Dockerfile、仓库或命令输出。生产模式缺少 token 会在绑定端口前拒绝启动。Dockerfile 的生产默认配置故意要求运行方安全注入该值；此轮未构建镜像、部署或配置真实密钥。

## 内部接口

- `GET /health`：基本进程存活状态，不代表真实来源已配置，不要求 token。
- `POST /v1/route-candidates`：JSON 请求，最大 64 KiB、请求体读取超时 5 秒。

请求保留 `requestId`、`query`、`origin`、`preferences`、`departureTime`、`sourcePolicy` 和 `anonymousSessionId`。兼容旧扁平字段 `message`、`destinationHint`、`originLabel`、`city`、`originPoint`、偏好字段和来源开关。嵌套字段优先于同名旧字段，显式偏好（包括空列表）优先于关键词推断。

- `query` 必须是 1–120 字符非空字符串。
- `origin` 支持 `label/city/lng/lat/source`；坐标必须成对且有限，合法的海外坐标会移除并返回 `ORIGIN_COORDINATES_IGNORED`，避免传播开发工具模拟位置。
- `preferences` 支持 `ageRange/duration/difficulty/transport/driveLimitMinutes/scenePreferences/safetyNeeds`，以及可选的 `companions/activityType`。
- `departureTime` 保留 `mode/iso/timezone/date/time/label`，`iso` 存在时必须包含时区。
- `sourcePolicy` 支持四个布尔开关 `includeSystem/includeMap/includeGuide/includeUserShared` 和整数 `limit`（1–50，默认 10）。被禁用的 Connector 不会调用。演示来源受 `includeSystem` 控制。

成功外壳：

```json
{
  "ok": true,
  "requestId": "req_example",
  "status": "NO_SEARCH_RESULTS",
  "resultType": "CANDIDATE_REFERENCE",
  "intent": {
    "raw": "附近走走",
    "query": "附近走走",
    "origin": {},
    "preferences": {},
    "departureTime": null,
    "sourcePolicy": {"includeSystem": true, "includeMap": true, "includeGuide": true, "includeUserShared": true, "limit": 10},
    "anonymousSessionId": "",
    "companions": [],
    "difficulty": "unknown",
    "scenery": [],
    "activityType": "hiking"
  },
  "items": [],
  "warnings": ["SOURCE_NOT_CONFIGURED"],
  "generatedAt": "2026-09-29T00:00:00Z"
}
```

状态：正常来源返回结果为 `READY`，正常空结果为 `NO_SEARCH_RESULTS`，来源失败、超时、无效证据或演示模式为 `DEGRADED`。Connector 失败不编造候选；已有的合格候选可以随降级状态一起返回。

候选具有 `candidateId/id/rank/title/subtitle/sourceType/sourceLabel/collectedAt/sourceEvidence/previewOnly/adoptionRequired/matchReasons/missingItems/riskWarnings/routeStats/geo`。来源证据必须包含 `sourceId/type/label/accessMode/collectedAt`，可包含 `url/expiresAt`。演示数据只标为 `LOCAL_PREVIEW` + `MOCK` + `previewOnly: true` + `adoptionRequired: false`，禁止采纳，Java 必须拒绝创建正式资产。此处 `adoptionRequired: false` 不表示已采纳。

错误外壳：

```json
{
  "ok": false,
  "error": {"code": "INVALID_REQUEST", "message": "Malformed JSON body", "retryable": false},
  "requestId": "agent_req_...",
  "correlationId": "corr_..."
}
```

错误包括 400 `INVALID_REQUEST/ORIGIN_INVALID`、401 `UNAUTHORIZED`、404 `NOT_FOUND`、408 `REQUEST_TIMEOUT`、413 `REQUEST_TOO_LARGE`、415 `UNSUPPORTED_MEDIA_TYPE`、500 `INTERNAL_ERROR`。无效 JSON、重复成员、NaN、数组和错误类型均不进入推荐逻辑。日志只写响应状态码，不写原始 query、坐标、请求路径、token 或异常堆栈。

## 模块与后续接入

- `app/contracts.py`：校验、扁平兼容、意图解析。
- `app/candidates.py`：Connector 协议、来源选择、证据验证、去重、结果数量和期限。
- `app/server.py`：HTTP、请求体限制、鉴权和错误外壳。

新 Connector 实现 `source_type` 和 `fetch(intent, *, deadline)`，通过 `AgentServer(..., connectors=(...))` 注入；只允许已知来源类型。每个真实 provider 的 I/O 必须遵守传入的单调时钟 deadline。调用有总等待预算和最多 8 个 Connector worker；超时未退出的 worker 保留槽位直到结束，防止不断产生后台线程。Python 线程不能强制终止 provider，应在真实接入阶段补全 provider 自身的网络超时和限流。

按 provider/placeId、名称/地点或来源标识去重，并合并证据、风险和待确认项；最终按来源顺序给出稳定 rank，再应用 limit。当前未接入真实 provider，也未实现按距离/时长的生产排序，不能把契约测试通过当作外部路线质量验收。

## 测试

无网络、无数据库的契约和故障测试：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s agent-python/tests -v
```

可选的真实 HTTP 测试仅在临时 loopback 端口启动本项目进程，测试结束关闭服务器；受限环境需要允许本地端口绑定：

```bash
PYTHONDONTWRITEBYTECODE=1 RUN_AGENT_HTTP_TESTS=1 python3 -m unittest discover -s agent-python/tests -v
```

所有非演示候选都是测试注入 fixture，不访问真实地图、攻略网站或数据库。
