# 当前治理基线

状态：active  
当前 change：`backend-implementation-architecture`

## 2026-09-29 当前执行基线

用户已接受原型并回复“可以，继续”。当前进入 B0/B1 本地实现与验证，详见 `backend-execution-baseline.md` 和 `context/backend-implementation-handoff.md`。下方 2026-09-22—28 记录为历史状态，不能用于推断本轮验证结果。

- 当前范围：Java Spring Boot/JDBC 业务事务、Python Agent 契约、小程序 API 与提交状态适配；原型视觉沿用已接受设计。
- 使用已缓存依赖离线构建；本地 H2 验证持久化与事务。MySQL migration 为待验证草案，不访问现有数据库。
- 当前门禁：开发自测进行中；随后独立代码审查、QA、执行后诊断与 reviewer。尚不标为生产可用或人工验收通过。
- 真实来源、生产身份鉴权、目标 MySQL、云部署和小程序真机联调仍是上线前条件。

## 2026-09-25 H5 demo 小程序转译

- 用户已评审并要求将 H5 demo 的 UI 方向用于小程序。
- 文档驱动分诊：`required`。范围是首页、结果、详情、反馈和小程序导航外壳的完整 UI 改造；已用 H5 DESIGN.md 锁定模式与直接映射。
- 用户价值：更快表达出行诉求，读懂推荐理由、来源和变化信息，再决定是否加入路线；反馈闭环保持可达。
- 当前 change：`openspec/changes/miniprogram-h5-demo-ui-translation/`。
- 实施边界：改动小程序 shell、四页 WXML/WXSS、必要的详情页 shell 导航 glue、客户端 API 归一化和治理文件；保留后端接口、存储、数据与页面路径；不复制 H5 mock 路线内容。
- 反向思考：H5 静态路线不适用于真实小程序数据；页面级链接只使用现有小程序页面路径。原生 safe-area 仍需微信开发者工具人工验收。
- 不执行依赖安装、数据库变更、部署、Git commit/push 或生产同步。

| 文档槽位 | 当前文档 | 状态 |
|---|---|---|
| PRD / 范围 | `product-requirements-framework.md`、`product-phase-one-scope.md`、`docs/product/phase-one-prd.md` | active |
| 架构 | `docs/architecture/backend-implementation-architecture.md` 与 `backend-execution-baseline.md` | active；旧一期架构为历史 |
| UI / 交互 | `docs/design/phase-one-miniprogram-design.md`、`ui-mode-card.md` 与 `outdoor-recommendation-exploration/DESIGN.md` | active |
| 验收 | `openspec/changes/backend-implementation-architecture/tasks.md` 与本 change 后续门禁记录 | active；历史 smoke 不代表本轮通过 |

## 当前事实

- 目标项目已具备小程序可运行基线。
- 当前 change 将小程序首页、结果、详情和反馈页转译为 `outdoor-recommendation-exploration` 的 quiet field guide 视觉方向。
- 本 change 保留后端 API 契约、存储、页面路径、收藏、地图、反馈和 fallback 行为；客户端 API 只增加嵌套响应、来源证据、地图坐标和旧字段的兼容归一化；详情页 JS 仅保留页面跳转 glue。
- 本 change 不执行依赖安装、数据库变更、部署、Git 提交或生产同步。
- 项目级产品框架已从原项目提炼完成；本框架只锁定产品目标、边界、一级模块和版本主线，不锁定技术实现。
- 已补充市场与竞品调研；当前结论是存在直接竞品，但“低门槛出发决策 + 可信路线治理”仍需通过区域和用户验证。
- 产品核心已补充为“多来源信息采集与治理 + 用户要求驱动推荐”；人工录入降级为备用和治理手段。
- 一期范围已收敛为“可靠路线参考”：用户只输入一句诉求，系统主要从各平台和受控 Skill 获取路线信息并保证来源可靠，不扩展完整出行决策能力。
- 数据落地规则已收敛：外部平台和 Skill 结果先作为候选参考，只有用户明确采纳的路线才进入正式路线资产；浏览或查看不视为采纳。

- 一期本地 MVP 已完成：Java Business API、Python Agent、MySQL schema、Dockerfile、小程序采纳动作和本地 smoke 均已就绪；状态为 ready_for_human_acceptance。

- 用户指出首页 UI 不符合一期“一句话输入”原则；已建立 `miniprogram-single-sentence-input` 修正 change，将自然语言输入设为唯一主入口，等待微信开发者工具人工验收。该阶段由本次 H5 demo 转译接续。

## 2026-09-24 UI 重构更新

- 用户反馈：首页仍太混乱、缺乏产品感。
- 当前主导岗位：frontend-ui-designer；技术总监负责范围控制与门禁。
- 竞品启发：路线/地图/内容搜索类产品普遍采用强搜索入口、弱装饰、来源/评价在结果层承载。
- 已完成：新增 `docs/design/phase-one-homepage-product-ui-redesign.md`；首页移除 Field Guide 山水装饰和天气贴纸，改为“一句话输入 → 主 CTA → prompt 示例 → 上下文 → 可信说明 → 二级筛选”。
- 新 change：`openspec/changes/miniprogram-product-homepage-redesign/`。
- 当前状态：静态检查通过，等待 code-review / QA 记录与微信开发者工具人工视觉验收；未部署、未提交 Git、未修改后端和数据库。
- 历史门禁观察（2026-09-24）：当时未在本项目找到治理检查脚本。2026-09-25 已在外部 dev-team 源仓库找到并只读调用文档基线检查，不能继续据此声称脚本不可用。
- 文案纠偏：用户反馈首页文案过于 IT 化；已将用户端“Skill / 候选 / 入库 / 正式资产 / 系统落地”等内部语言改为“帮你找 / 先看看 / 出发前看一眼 / 加入我的路线”等产品语言，并同步更新结果页、详情页、反馈页可见文案。

## 2026-09-25 按钮回归纠偏

- 原因：基础库 v2 的 184px 按钮规则优先级高于前次全局/单类宽度声明，重新编译仍会覆盖；没有证据归因于用户缓存或目录。
- 本轮范围：四页 WXSS + 首页/详情 WXML，JS/JSON/工具函数与本轮快照一致。
- 验证：3 个旧版复现 + 84 个新版编译产物布局/状态回归通过；390px 搜索宽从 184px 变为 330px，快捷项从六行变两行。
- 文档基线：外部 dev-team 脚本已找到；修正 current.md 引用后通过（0 warnings）。
- 状态：局部修复已验证；全量原生视觉和交互验收、独立 reviewer 仍待完成。本轮 subagent 调用不受支持，专业门禁记录均明确 fallback_local_only。
- 交接：`docs/project-governance/context/button-regression-handoff.md`；change 内 qa-report / diagnostic-post / reviewer 与 KPI 候选记录是当前纠偏证据。

## 2026-09-26 完整 H5 demo UI 重构

- 用户明确纠正范围：需要按 H5 demo 重构小程序整体 UI，按钮级联只是其中一个修复点。
- 首页补回出发条件卡，直接承载“从哪里出发”和“计划出发”两个已有 picker 入口；结果页保留来源、理由、事实、风险和操作层级。
- 详情页补回路线节奏、信息边界、出发前准备，并加入与 demo 一致的移动端底部导航；导航只跳转到已有发现、找路线、分享路线页面。
- 反馈页继续保留纠错和分享路线两种模式，四页统一品牌头部、位置胶囊、卡片边界、森林绿主操作和 clay 变化信息。
- 本轮仅做本地编译产物和隔离浏览器验证；独立 code-reviewer / QA / reviewer dispatch 不可用，记录为 `fallback_local_only`。微信安全区、胶囊、键盘和触摸验收仍待完成。

## 2026-09-28 结构减法

- 用户继续反馈页面层级和文案偏多，要求简洁、低认知成本。
- 首页收敛为一句输入、三个示例、出发地/时间一行和折叠筛选；移除支持卡与路线预览。
- 结果页移除重复来源条和独立边界提示，路线卡保留标题、事实、匹配理由、来源、出发前提示与操作。
- 详情页合并出发前确认、风险和准备内容，保留短参考走法与纠错/地图/想去操作。
- 反馈页改为单列短表单；移除固定底部导航，改用页面级返回和操作入口，降低持续视觉噪音。
- 结构减法子轮次主要改动四页 WXML/WXSS；随后户外氛围与 API 归一化子轮次增加客户端适配层改动，后端 API、存储、数据库、依赖和路径保持不变。静态检查和文档门禁通过，微信开发者工具 / 真机视觉、键盘、触摸与安全区仍需人工验收。

## 2026-09-28 户外氛围与 API 归一化

- 用户要求参考 H5 demo 的天空、草地、水面色彩，页面保持干净、低认知成本。四页使用 CSS 渐变建立浅天空、草地、水面和暖阳层次，内容卡保持半透明白色以保证可读性。
- 客户端 `apiClient.js` 增加响应解包和字段兼容：支持 `data` 包裹、`items/results/candidates` 列表、来源证据 `sourceEvidence/sources`、经纬度别名和详情响应嵌套；不改变后端路径、请求方法或采纳/反馈契约。
- 反向思考：背景色不能替代来源、风险和地图可用性提示；API 兼容只在客户端适配层完成，避免把未验证的外部数据当成确定事实。后端 smoke 和微信原生视觉仍需单独验收。

## 2026-09-28 H5 结构对齐纠偏

- 用户反馈微信开发者工具截图仍显示旧首页结构，确认此前只完成了部分颜色和按钮转译。当前小程序首页已对齐 H5 demo 的品牌锁定、标题层级、白色搜索卡、快捷输入和森林绿主操作；结果、详情、反馈页统一紧凑品牌头和户外背景。
- 结果页标题统一为“选一条去走”，详情页使用路线主卡和事实卡，反馈页保留单列短表单；业务 API、存储、页面路径、地图、收藏、采纳、反馈事件保持不变。
- 重新执行 `wcc`/`wcsc`、JS、JSON、WXML/WXSS 结构和事件绑定检查；反馈 WXSS 使用 `pageCount: 5` 单独确认纳入批量编译。微信开发者工具真机视觉、安全区、键盘和触摸验收仍保持开放。

## 2026-09-28 后端实现与架构设计

- 用户确认当前原型基本满足需求，后续工作转入后端实现与架构设计；新 change 为 `openspec/changes/backend-implementation-architecture/`，不把后端规划混入已完成的 UI change。
- 设计基线来自当前小程序四页、`apiClient.js`、Java Business API、Python Agent、MySQL schema 和一期 PRD。目标闭环为：一句话诉求 → 路线参考 → 详情 / 地图 → 加入 → 纠错 / 补充路线。
- 已确认的后端缺口：详情、反向地理编码、纠错、用户补充路线接口未实现；搜索条件被 Java 丢弃；候选和请求未持久化；采纳无归属校验和幂等事务；事件接口不落库；Cloud Run 的 Agent loopback 地址与分服务部署不闭合。
- 已产出 `docs/architecture/backend-implementation-architecture.md`，按 B0 契约冻结、B1 Java + MySQL、B2 Agent、B3 治理、B4 部署验收分期。当前只完成设计，不执行依赖安装、真实数据库变更、部署或 Git 提交。
