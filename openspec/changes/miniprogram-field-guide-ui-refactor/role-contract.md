# Role Contract

## Change / Module

`miniprogram-field-guide-ui-refactor` / 小程序 Field Guide UI 重构

## Global Goal

让小程序用户端与 `outdoor-recommendation-exploration` 形成一致但非复制式的视觉语言，同时保持既有功能链路。

## Role Boundaries

| Role | Must Do | Must Produce | Must Not Do | Handoff Gate | Evidence |
|---|---|---|---|---|---|
| tech-director | 分诊、范围锁定、阶段门禁、收口 | 范围和阶段结论 | 不替 UI 岗位编写完整设计正文 | 设计范围明确 | execution lock |
| product-analyst | 约束用户价值和行为不变 | 需求与验收口径 | 不擅自改变推荐业务 | 需求可验证 | proposal/spec |
| frontend-ui-designer | 将 DESIGN.md 转译为页面模式、token、状态 | UI Mode Card / 页面映射 | 不改 API 和业务规则 | UI 门禁 | `docs/project-governance/ui-mode-card.md` |
| programmer | 按 UI 契约改造 WXML/WXSS 并自测 | 实现与静态验证 | 不引入依赖、修改后端或扩大范围 | 开发门禁 | 页面文件与命令结果 |
| code-reviewer | 检查正确性、范围、安全、可维护性 | review 结论 | 不替开发补实现 | blocker 清零 | code-review |
| qa | 检查页面结构、脚本依赖、fallback 和视觉验证 | QA 报告 | 不跳过失败结果 | QA 通过 | qa-report |
| diagnostician | 检查执行漂移和证据缺口 | post-execution diagnosis | 不替代 reviewer | 诊断完成 | diagnostic-state |
| reviewer | 独立终审 | reviewer 结论 | 不把视觉探索误报为产品验收 | reviewer 门禁 | reviewer.md |

## Stage Gates

- UI 模式确认：UI Mode Card 和探索页映射完成。
- 首页切片：首页和全局 token 通过静态检查。
- 结果切片：结果卡保留事实、来源和行动。
- 详情/反馈切片：决策、风险和表单可用。
- QA / 诊断 / reviewer：证据完整后才能收口。

## Evidence Requirements

- DESIGN.md 直接采用映射。
- 页面代码和静态命令结果。
- 浏览器探索页回归截图；小程序真实视觉仍需微信开发者工具人工验收。
- 不新增依赖、不改后端的范围证据。

## Drift Risks

- 把 Web 探索页直接照搬成小程序页面。
- 只改颜色而不改信息层级。
- UI 重构破坏现有数据字段和交互。
- 用新视觉掩盖不确定信息。

## KPI Recording Rules

- 只记录职责缺失、越界、证据缺口或执行漂移。
- 视觉偏好差异不自动记录为 KPI。
