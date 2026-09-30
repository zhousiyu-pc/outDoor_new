# 需求追踪矩阵

2026-09-29：当前 change 为 backend-implementation-architecture；一期骨架及 UI 行是历史验证，本轮后端必须取得新的独立门禁证据。

## 当前本地实现覆盖

| 契约 | 实现文件 | 验证入口 | 边界 |
|---|---|---|---|
| 搜索条件校验与保留 | Java RequestContract / BusinessService；Python contracts.py；小程序 apiClient / journeyStore | BusinessApiTest；test_agent.py；backend-contract.cjs | 两端边界差异由代码审查修复回归；会话只由 Java 保存 |
| 请求、候选、来源、结果快照 | BusinessRepository、schema-local.sql | BusinessApiTest；run_phase_one_smoke.py | H2 临时与文件库，不等于 MySQL 验收 |
| 并发采纳、事务幂等、候选归属 | IdempotencyService、BusinessService、CandidatePolicy | BusinessApiTest | 身份暂为本地匿名会话，生产启动受阻断 |
| 公开详情、正式资产分享冷启动 | CandidatePolicy；plan-detail.js；feedback.js | BusinessApiTest；backend-contract.cjs | 公开字段最小化；微信真机仍待验收 |
| 纠错、投稿与真实提交状态 | RequestContract、BusinessService；feedback.js / apiClient.js | BusinessApiTest；backend-contract.cjs；smoke 最小投稿 | 候选需原请求归属；资产反馈允许查看者；待审核内容不自动公开 |
| 预览隔离与故障语义 | Agent candidates.py / server.py；AgentClient；results.js | test_agent.py / test_http.py；BusinessApiTest；smoke | 无 provider 则无真实路线，demo 禁止正式采纳 |
| 来源链接隐私 | CandidatePolicy | BusinessApiTest；独立 code-review | query / fragment 修复后回归；不凭空提供来源证据 |
| 部署拓扑与可运行入口 | backend-java/pom.xml / Dockerfile；agent-python/Dockerfile；infra/wx-cloudrun；README | 离线 package；双进程 smoke | 镜像构建、目标 MySQL、生产鉴权与部署保持未完成 |

开发自查与门禁记录：当前 change 中 client-developer-check、developer-check、code-review、QA、diagnostic、reviewer；未生成的记录保持待完成，不引用历史通过结论。

## 历史与项目级追踪

| 需求 / 目标 | 产品 | 架构 | UI | 开发 | QA | reviewer | 证据 |
|---|---|---|---|---|---|---|---|
| 用户一句诉求获得候选路线 | `phase-one-prd.md` | Java API → Python Agent | 小程序首页保留一句话输入 | `backend-java/`、`agent-python/` | smoke PASS | 通过 | `scripts/run_phase_one_smoke.py` |
| 候选路线带来源依据 | PRD / 来源框架 | Agent 返回 source / collectedAt | 结果页显示来源和时间 | Agent candidate payload | smoke + review | 通过 | `agent-python/app/server.py`、`apiClient.js` |
| 用户明确采纳后才落地 | PRD / phase one scope | Java owns adoption | 结果页采纳按钮 | `/api/user/routes/adoptions` | smoke PASS | 通过 | `PhaseOneBusinessServer.java` |
| 未采纳候选不进入正式资产 | data source framework | event endpoint不落地 | 浏览/详情/收藏非采纳 | search event returns false | code review | 通过 | `handleSearchEvent` |
| MySQL目标设计 | PRD | schema | 不适用 | `database/mysql/phase_one_schema.sql` | 文档检查 | 有条件通过 | 未执行DB变更 |
| 微信云Docker准备 | 架构 | Dockerfile | 小程序callContainer保持 | `infra/wx-cloudrun/Dockerfile` | 文档检查 | 有条件通过 | 未部署 |

| UI-REDESIGN-01 | 用户反馈首页混乱、缺乏产品感 | `docs/design/phase-one-homepage-product-ui-redesign.md` | `miniprogram/pages/index/index.wxml`, `index.wxss` | 静态检查通过；微信开发者工具人工验收待完成 |
| UI-H5-TRANSLATION-01 | 用户要求按已评审 H5 demo 改造小程序 UI | `outdoor-recommendation-exploration/DESIGN.md`; `openspec/changes/miniprogram-h5-demo-ui-translation/design.md` | `miniprogram/app.json`, `app.wxss`, four pages' WXML/WXSS/JSON | Static checks and code review; WeChat visual acceptance remains human |

| UI-BTN-01 | 快捷选项与主 CTA 应呈现已评审的布局 | 无 API/业务契约改变 | UI mode card 原生按钮映射 | 四页 WXSS、两页 WXML | 3 旧版 + 84 新版回归 PASS | fallback_local_only；独立/原生验收待完成 | change/evidence/button-layout-regression.json |
| UI-H5-FULL-01 | 按 demo 重构完整四页 UI，而非只修按钮 | H5 `DESIGN.md` + 用户 2026-09-26 范围纠正 | 首页出发条件、结果证据层、详情节奏/边界/准备、反馈表单与共享导航 | WXML/WXSS + 详情页 shell 导航 glue | 编译、事件、布局回归；原生视觉待人工 | fallback_local_only；独立 reviewer / 微信验收待完成 | change `qa-report.md`, `diagnostic-post.md`, `reviewer.md`, evidence |
| UI-SIMPLE-01 | 用户要求简洁、低认知成本 | H5 `DESIGN.md` 的单一主任务与分步呈现 | 首页单输入；结果单列表；详情单确认区；反馈单列短表单；去掉重复卡片和固定底栏 | 四页 WXML/WXSS，客户端 API 归一化保持页面字段稳定 | JS、JSON、事件、文档门禁通过；原生视觉待人工 | fallback_local_only；微信安全区、键盘与触摸待验收 | 当前 change `qa-report.md`, `diagnostic-post.md` |
| UI-OUTDOOR-01 | 用户要求户外场景多彩但页面干净 | H5 demo 的 sun / water / forest 色彩与 UI Mode Card | 四页低透明度天空、草地、水面、暖阳渐变；白色内容面保证可读 | 四页 WXSS、app.wxss | wcc/wcsc 编译通过；对比度和原生视觉待人工 | fallback_local_only；真实设备验收待完成 | 当前 change `qa-report.md`, `design.md` |
| BACKEND-PROTOTYPE-01 | 当前原型需要真实后端闭环 | 当前小程序四页、`apiClient.js`、一期 PRD | 原型视觉沿用，API 和提交状态按当前契约适配 | Java/JDBC/H2、Python Agent、小程序 JS；MySQL 仅迁移草案 | 开发自测与独立门禁进行中；不以历史 smoke 替代 | 用户已授权本地 B0/B1；生产验收未完成 | backend-execution-baseline.md；backend change tasks / 门禁记录 |
