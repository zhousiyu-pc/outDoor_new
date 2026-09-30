# 代码审查卡：B0/B1 本地后端与小程序契约适配

审查日期：2026-09-29  
岗位：独立 code-reviewer
审查结论：**blocked**

## 输入

- 执行基线：`docs/project-governance/backend-execution-baseline.md`
- 交接包：`docs/project-governance/context/backend-implementation-handoff.md`
- 契约：`openspec/changes/backend-implementation-architecture/specs/backend-runtime-contract/spec.md`
- 实现：`backend-java/`、`agent-python/`、`miniprogram/utils/`、`miniprogram/pages/`
- 开发自测：Java 11 个 JUnit、Python 14 个离线测试、Node 16 个测试（本次复跑均通过）
- 文档门禁：`check-document-baseline.py` 通过，0 warning

未收到独立的开发自查卡和逐项代码改动追踪矩阵；现有追踪矩阵仍将本轮开发和门禁标为“进行中”。这不单独作为实现缺陷，但会降低下游 QA 的证据完整性。

## 架构契约对齐

- Java 负责持久化、候选快照、采纳事务、幂等和公开详情；Agent 仅返回结构化候选。边界与实现基本一致。
- Agent 默认无来源返回 `NO_SEARCH_RESULTS`，显式演示才返回 `LOCAL_PREVIEW`/`MOCK`；Java 采纳会检查 preview 和有效来源。来源污染防护基本覆盖。
- 小程序写请求使用 `/api/v1`、稳定 `Idempotency-Key` 和 session；失败保存草稿，详情会向服务端取数。16 个 Node 测试覆盖了这些主路径。
- 真实 MySQL、真实来源、生产鉴权和部署仍是未完成边界；本审查没有把这些本地切片之外的事项当成本轮 blocker。

## Findings

### 已关闭：已采纳路线的分享链接仍分享候选 ID

证据：`miniprogram/pages/plan-detail/plan-detail.js:265-278`、`miniprogram/pages/feedback/feedback.js:108-120` 的 `onShareAppMessage`/`onShareTimeline` 总是读取 `plan.id`。`journeyStore.savePlanAdoption` 保留候选 `id=cand_*`，只另外写入 `routeAssetId`。因此一个已经采纳的路线仍生成 `...?id=cand_*`。

影响：分享者期望打开正式路线资产，但冷启动会调用候选详情；新会话无法通过候选的 `requestId + session` 所有权检查提交纠错（`BusinessService.feedback`/`ownedCandidate` 返回 `CANDIDATE_NOT_OWNED_BY_REQUEST`）。这使原型要求的“分享已加入路线、他人可查看并反馈”在无本地缓存时失败。

建议：已采纳且有 `routeAssetId` 时，分享路径和 query 使用 `routeAssetId`；详情页、反馈页保持正式资产分支。增加跨会话测试：采纳 → 生成分享路径 → 冷启动 GET `/user/routes/{routeAssetId}` → 新 session 提交 asset feedback。

### Important：Java 与 Python 的输入约束不一致，合法请求会被静默降级

证据：

- `backend-java/.../RequestContract.java:58-66,78` 允许 `origin.label/city/source` 长度 255，`driveLimitMinutes` 0–720，坐标经度上限 136；`agent-python/app/contracts.py:56-60,73,91` 分别限制为 120/80/80、1–1440、经度上限 135。
- Java 允许的 `originLabel`（121–255 字符）或 `driveLimitMinutes=0` 会通过业务层，随后 Agent 400；`AgentClient` 把非 200 统一变成 `DEGRADED`，没有把契约错误反馈为请求校验错误。
- Java 还没有把当前小程序传入的扁平 `city` 归入 `origin.city`（`RequestContract.java:55-67`），导致完整出发地条件到 Agent 时丢失。

影响：相同请求在 Java 入口和 Agent 入口产生不同结果，用户得到“服务降级”而不是可修正的输入错误，且违反完整条件透传契约。

建议：抽取共享 schema 或至少统一两端边界（推荐经度 135、drive limit 是否允许 0、各文本长度）；Java 对扁平 `city` 做兼容映射；为边界值增加跨语言 contract test。

### Important：公开详情会泄漏可复用的来源 URL 查询参数

证据：`backend-java/src/main/java/com/outdoor/business/CandidatePolicy.java:49-52,83-84` 对 `sourceEvidence.url` 只检查 `http/https`、host 和无 user-info，保留 query/fragment；`BusinessService.detail` 直接返回候选/资产 payload。带签名或 token query 的来源 URL 因而会进入未鉴权的公开详情。

影响：第三方来源的临时签名、访问 token 或带用户标识的查询参数可能被分享链接公开，扩大来源凭证泄漏范围。

建议：公开快照只返回经过 allowlist 的稳定 URL，剥离 query/fragment，或由受信来源生成不含凭证的 canonical URL；内部存储可保留原始引用但不得直接回显。增加 URL 带 query 的隐私回归测试。

### Advisory：公开快照仍包含内部 requestId

`CandidatePolicy.normalize` 将 `requestId` 写入候选 payload；`BusinessService.detail` 原样返回。虽然当前没有返回 session/query/origin，requestId 仍是内部关联标识，建议公开 DTO 去掉该字段，反馈和采纳内部继续使用持久化关系。此项不单独阻塞本地切片，但应在公开分享测试中确认。

### Advisory：Agent 响应总体大小缺少服务端上限

单个候选和证据字段有长度限制，但 Python `recommend` 可在 `limit<=50` 时组合大量 evidence，HTTP 层没有响应大小预算；Java 只在客户端读到 256 KiB 后拒绝。建议 Agent 在序列化前按字节预算裁剪，避免内部来源异常导致无效大响应。

## 后续复审发现

分享 ID 问题已关闭：两页 app-message/timeline 已优先 routeAssetId；新增 Node 第 17 项覆盖实际分享方法、冷启动资产 GET 和新 session 资产反馈。17/17 本次复跑通过。

部分来源失败尚待修正：BusinessService.java 49–52 在存在任一非 preview 候选时设 READY，未保留 Agent DEGRADED。Python 在某个 connector 超时/失败而其他 connector 返回有效候选时，会返回 DEGRADED 和有效 items。架构要求这种情况保留降级语义。建议保留上游 DEGRADED，并测试有效候选和来源错误并存时 items 与 warnings 均不丢失。

显式清空筛选尚待修正：index.wxml 27–28 允许场景和需要逐项取消；journeyStore.normalizeForm 220–225 和 apiClient.normalizeArray 149–150 以 length 判断数组，将显式空数组替换成默认值。用户清空后，搜索仍带公园/绿道和停车/厕所等过滤。建议只有缺失或非数组时才默认化，并回归“取消全部 → 保存 → 请求体”保持空数组。

新边界修复需要兼容当前日期对象：index.js 在 CUSTOM departure 中保存 userSelected:true，apiClient 原样发送。Java 不得因本地辅助字段而拒绝该原型动作；应由边界移除该字段后再传 Agent，并加入实际客户端日期对象回归。

已收到 client-developer-check.md，包含客户端、smoke、README、infra 改动映射及 17 项自测。smoke 静态核对仅使用自身 Popen 句柄、隔离环境、动态 loopback 和临时 H2，未发现执行范围阻塞。实际 HTTP 执行由 root/QA 留证。

## 验证充分性

本次复跑：

- `mvn -o test`：11/11 通过。
- `python3 -m unittest discover -s agent-python/tests -p test_agent.py -v`：14/14 通过。
- `node --test miniprogram/tests/backend-contract.cjs`：16/16 通过。
- 文档基线：通过，0 warning。

这些测试仍是 MockMvc、标准库 handler 和 Node harness；没有证明真实 MySQL migration、真实 provider、微信原生冷启动或跨进程 HTTP。尤其缺少上面标出的“采纳分享冷启动”跨会话场景。

## QA 建议

1. 修复分享链接后，执行跨会话 asset 分享/详情/反馈回归，并验证候选反馈仍保留原 `requestId`。
2. 用边界矩阵对 Java → Agent 输入做 120/121 字符、drive limit 0/1/720/721、经度 135/136、扁平 city 等测试，确认不会把契约错误伪装成 DEGRADED。
3. 加入来源 URL query/fragment 的公开详情隐私测试；检查资产详情没有 session、query、origin、内部关联字段和凭证。
4. 运行 root 编排的临时本地双进程 smoke；保留 H2/MockMvc 与真实 MySQL/来源的能力边界说明。

## Skip reason

未跳过审查。生产 MySQL、真实来源、身份认证和部署属于本轮明确未授权/未完成边界，由后续 QA、diagnostician、reviewer 和发布门禁处理。
