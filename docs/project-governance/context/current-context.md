# 当前上下文

更新时间：2026-09-29

## 身份与任务

技术总监主控，当前 change：`backend-implementation-architecture`。用户接受原型后要求继续，目标是实现并验证本地 B0/B1 后端及 Agent / 小程序契约适配。执行基线为 `../backend-execution-baseline.md`，当前交接为 `backend-implementation-handoff.md`。下方既有 UI 和 smoke 记录是历史证据，不能视为本轮后端通过。

当前开发分工：business_backend 负责 Java/JDBC/SQL；agent_contract 负责 Python；client_contract 负责小程序 JS。开发后按独立代码审查 → QA → diagnostician → reviewer 顺序推进。允许本地源代码、测试和缓存依赖构建，不访问既有数据库、不部署、不修改生产凭据。

## 当前产物

- 产品文档：`docs/product/phase-one-prd.md`
- 架构文档：`docs/architecture/backend-implementation-architecture.md`
- 设计文档：`docs/design/phase-one-miniprogram-design.md`
- 测试文档：`docs/testing/phase-one-test-plan.md`
- Java Business API：`backend-java/`
- Python Agent：`agent-python/`
- MySQL schema：`database/mysql/phase_one_schema.sql`
- 微信云 Docker 准备：`infra/wx-cloudrun/`
- OpenSpec：`openspec/changes/phase-one-microservice-agent/`
- H5 UI 转译 OpenSpec：`openspec/changes/miniprogram-h5-demo-ui-translation/`

## 历史已验证（新实现须重新验证）

- `python3 scripts/check_phase_one_docs.py`：PASS
- `find miniprogram -name '*.js' -print0 | xargs -0 -n1 node --check`：PASS
- `python3 scripts/run_phase_one_smoke.py`：PASS

## 当前边界

- 已允许：本地文档、代码、脚本、Dockerfile、schema 草案。
- 未执行：依赖安装、真实 MySQL 变更、微信云部署、Git commit/push、真实外部平台抓取。
- 人工验收必需：微信开发者工具预览、采纳按钮体验、云托管部署前配置。

## 历史 UI change 的额外边界

- 后端 API、存储、真实推荐数据、页面路径和已有交互保持不变；`apiClient.js` 增加客户端响应归一化与字段别名兼容；详情页已有页面跳转 glue 保留。
- 不引入 H5 mock 数据、浏览器 tab 目的地、依赖、图片或字体；页面级链接仅使用已有四页中的支持路径。
- 微信开发者工具/真机 safe-area 与视觉验收仍需完成。

## 历史设计阶段下一步（已由本地执行基线接续）

用户人工验收后，再决定是否授权：

1. 真实 MySQL 连接和迁移；
2. Spring Boot / FastAPI 正式依赖接入；
3. 真实平台来源 / Skill 接入；
4. 微信云托管部署。

## 2026-09-25 重复反馈修复

- 用户反馈重新编译样式仍未变化。根因：微信 v2 `wx-button:not([size=mini])` 的 184px/auto margin 规则优先级压过旧样式。
- 已修正四页按钮作用域/尺寸、首页与详情原生 view 换行；页面业务 JS 未改。
- 3 个修复前复现、84 个修复后布局及颜色断言通过。证据：当前 change 的 evidence/。
- 全部 JS/JSON/事件存在性、OpenSpec strict、文档基线与一期文档检查通过。
- 前次“已经修复 / 无过程问题”的描述已被本轮 QA 与诊断纠正；KPI 候选只写项目内。
- 因 subagent 调用返回 unsupported，独立门禁未冒充通过；当前是 fallback_local_only。原生安全区、键盘、胶囊、交互及完整视觉验收仍待完成。
- 当前交接：`button-regression-handoff.md`，不要按旧 ready_for_human_acceptance 文案推断整体 UI 已验收。

## 2026-09-26 完整 UI 重构 re-entry

- 用户明确要求按 H5 demo 重构整体小程序 UI，不接受只调整按钮。
- 已补：首页出发条件卡与两个 picker 入口；详情路线节奏、数据边界、准备清单；详情页底部导航；共享 shell 的文案与治理记录。
- 结果目标是完整四页视觉路径：发现 → 一句话搜索 → 理由与来源 → 详情和出发时间 → 采纳 / 地图 / 反馈。
- 本地验证应覆盖新 WXML/WXSS、详情导航事件和不同屏宽；不得把隔离浏览器截图写成真实微信 IDE 验收。

## 2026-09-28 文案精简

- 用户要求四页减少解释型文案，页面做到一眼知道怎么操作。
- 首页保留一句输入、快捷入口、出发设置和必要来源提示；结果页保留路线事实、匹配理由、来源和出发前提示；详情页保留事实、风险、时间和操作；反馈页保留字段、标签、备注和提交。
- 长说明已压缩为短标题、短按钮和短提示，动态路线摘要仍由真实数据提供并通过两行截断控制密度。
- 本轮通过 wcc/wcsc、JS、JSON、事件绑定和文档门禁；Chrome 进程在当前环境无法启动，未新增浏览器截图证据。

## 2026-09-28 户外背景与 API 适配

- 四页背景已改为浅天空、草地、水面和暖阳的多层渐变；内容区使用白色或半透明白色卡片，保留森林绿主操作和赭石提示色。
- API 客户端现在可处理 `data` 嵌套响应、候选列表别名、来源证据别名、经纬度别名和详情嵌套响应，并统一生成地图动作和决策事实。
- 已完成 `node --check`、归一化样例、WXML/WXSS 编译、文档基线与一期文档检查；后端 smoke 重跑被沙箱禁止本地端口监听（`Operation not permitted`）。微信开发者工具 / 真机安全区、触摸和原生渲染仍需人工验收。

## 2026-09-28 结构减法

- 用户明确要求简洁、大方、低认知成本，不能继续叠加说明卡和导航层。
- 当前实现将四页改为单列任务流：输入 → 选路线 → 确认 → 操作；删除固定底栏与重复说明，保留原业务入口。
- 验证：四页 JS 语法、WXML 事件方法存在性、文档基线与一期文档检查通过；后端 smoke 因当前沙箱禁止监听本地端口未能重跑，不影响本次 CSS/WXML 范围判断。
- 微信开发者工具/真机验收仍需关注安全区、胶囊、键盘、触摸目标和滚动。

## 2026-09-28 H5 结构对齐纠偏

- 最新截图对应旧版首页结构；用户反馈成立。此次补齐了首页 H5 demo 的品牌方标、品牌副标题、`周末去哪` / `找条合适的路`、输入卡、快捷项横向行和森林绿 CTA，并把结果、详情、反馈页顶部统一为同一品牌头。
- 结果页改为“选一条去走”，详情页改为深绿路线主卡 + 暖白事实卡，反馈页保留简短单列表单；没有改变 API、存储、导航路径或业务事件。
- 本轮已用项目实际 `miniprogramRoot: miniprogram/` 编译四页 WXML；`wcsc` 需要 `pageCount: 5` 才返回全局样式加四页 WXSS，反馈页已单独确认通过。剩余仅是微信开发者工具运行态截图与安全区/键盘/触摸验收。

## 2026-09-28 后端设计 re-entry

- 用户确认当前原型已基本满足需求，后续目标转为按照原型设计后端实现和架构；当前 change 切换为 `backend-implementation-architecture`。
- 设计主文档：`docs/architecture/backend-implementation-architecture.md`；OpenSpec 交接包：`openspec/changes/backend-implementation-architecture/`。
- 调查结论：现有 Java/Python 是本地骨架，MySQL schema 尚未接入运行时；客户端已经使用的详情、反向地理编码、反馈和路线补充接口缺失；Java 丢弃大部分搜索条件；采纳、事件和用户贡献没有可靠持久化；部署配置默认 loopback Agent 地址。
- 设计状态：没有阻止开始架构设计的客观问题；在 B0 契约、B1 持久化和幂等事务完成前，不能声称后端已支持原型真实生产闭环。依赖安装、数据库变更和部署仍需用户单独授权。
