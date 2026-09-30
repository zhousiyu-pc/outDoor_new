# Role Contract

## Change / Module

`phase-one-microservice-agent` / 一期可靠路线参考微服务版

## Global Goal

交付一版可人工验收的一期闭环：一句诉求、多来源候选、用户采纳、正式落地。

## Role Boundaries

| Role | Must Do | Must Produce | Must Not Do | Handoff Gate | Evidence |
|---|---|---|---|---|---|
| tech-director | 分诊、范围锁定、门禁、收口 | 阶段结论 | 不跳过角色门禁 | 文档与停止条件清楚 | current / reviewer |
| product-analyst | 一期范围、验收口径 | PRD | 不决定具体技术实现 | 需求可测 | PRD / spec |
| architect | 微服务边界、数据流、部署边界 | 架构文档 | 不扩产品范围 | 方案可实现 | architecture |
| frontend-ui-designer | 一句话输入与采纳体验 | 设计文档 | 不改业务规则 | UI 状态清楚 | design |
| programmer | 实现最小切片并自测 | 代码和脚本 | 不安装依赖、不部署、不写真实 DB | smoke 通过 | code / scripts |
| code-reviewer | 代码级审查 | review | 不替开发补功能 | blocker 清零 | code-review |
| qa | 测试执行 | QA 报告 | 不跳过失败 | 测试可复现 | qa-report |
| diagnostician | 执行漂移检查 | diagnostic | 不最终验收 | 无回退项 | diagnostic-state |
| reviewer | 独立终审 | reviewer 报告 | 不替代人工验收 | 证据完整 | reviewer |

## Stage Gates

- 需求确认：PRD 与 OpenSpec spec 完成。
- 技术方案确认：架构文档完成。
- UI / 交互确认：设计文档完成。
- 开发完成：Java/Python/小程序/SQL/Dockerfile 完成。
- 诊断完成：无执行漂移。
- 验收完成：reviewer 后进入人工验收。

## Evidence Requirements

- 文档证据：PRD、架构、设计、测试计划。
- 代码 / 配置证据：Java、Python、小程序、SQL、Dockerfile。
- 验证命令：smoke、JS syntax、doc check。
- 外部审计证据：本地无生产外部写入，不触发。

## Drift Risks

- 直接抓取外部平台绕过授权。
- 未采纳候选进入正式资产。
- Agent 直接写 DB。
- 未授权安装依赖或部署。

## KPI Recording Rules

仅当出现职责缺失、边界越界、证据不足或执行漂移时记录 KPI。
