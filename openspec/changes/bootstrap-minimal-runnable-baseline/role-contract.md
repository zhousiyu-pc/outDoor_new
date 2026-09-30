# Role Contract

## Change / Module

`bootstrap-minimal-runnable-baseline` / 小程序可运行基线

## Global Goal

让目标项目具备可被微信开发者工具识别的完整小程序入口，同时为后续迁移阶段保留清晰边界。

## Role Boundaries

| Role | Must Do | Must Produce | Must Not Do | Handoff Gate | Evidence |
|---|---|---|---|---|---|
| tech-director | 分诊、范围锁定、门禁、收口 | 阶段结论 | 不替专业岗位扩展迁移范围 | 目标和停止条件清楚 | 本 change 与执行锁 |
| product-analyst | 说明本切片用户价值和非目标 | 范围与验收口径 | 不决定后端实现 | 需求可验证 | proposal/spec |
| architect | 说明复用路径、配置和风险 | 设计决策 | 不引入 Python/MySQL 未授权改造 | 依赖关系明确 | design.md |
| programmer | 补齐小程序文件并自测 | 实现与命令结果 | 不修改生产后端或安装依赖 | 静态检查通过 | miniprogram、project.config.json |
| code-reviewer | 检查正确性、安全、范围 | review 结论 | 不替开发补功能 | blocker 清零 | review 记录 |
| qa | 执行结构、JSON、JS 和 fallback 检查 | QA 证据 | 不跳过失败结果 | 测试可复现 | 命令输出 |
| diagnostician | 判断执行是否偏离契约 | 诊断结论 | 不替代 reviewer | 无需回退或明确回退 | diagnostic-state |
| reviewer | 独立终审 | 验收卡 | 不默认为已完成迁移 | 证据完整 | reviewer 结论 |

## Stage Gates

- 需求确认：proposal/spec 明确本切片范围和非目标。
- 技术方案确认：design.md 明确复用来源、配置和风险。
- 开发完成：页面、工具和项目配置齐全。
- QA 完成：静态验证和 fallback 验证通过。
- 诊断完成：无执行漂移或已记录回退。
- 验收完成：reviewer 通过，技术总监决定是否需要人工验收。

## Evidence Requirements

- 文档证据：本 change 全套治理文件。
- 代码 / 配置证据：`miniprogram/` 与 `project.config.json`。
- UI 视觉证据：本轮复用既有页面，不新增视觉设计；微信开发者工具截图留作后续人工验收。
- 验证命令：JSON 解析、JS 语法、相对依赖扫描、治理检查。
- 外部审计证据：本低风险本地切片不要求外部审计。

## Drift Risks

- 将“可运行基线”误报为 Java/Python/MySQL/Agent 迁移完成。
- 未经确认修改云环境、数据库或生产配置。
- 复用参考项目时丢失页面依赖。

## KPI Recording Rules

- 只有发现职责遗漏、边界越界、证据缺失或执行漂移时记录 KPI 候选。
- 单纯的风格偏好不记录为 KPI。
- 本 change 当前无 KPI 事件。
