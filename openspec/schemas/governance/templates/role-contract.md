# Role Contract

## Change / Module

<!-- change id, module name, or product version -->

## Global Goal

<!-- What this work must achieve for the product or production version -->

## Role Boundaries

| Role | Must Do | Must Produce | Must Not Do | Handoff Gate | Evidence |
|---|---|---|---|---|---|
| tech-director | 分诊、编排、门禁、纠偏、收口 | 阶段结论 / 交接结论 | 不替专业岗位写完整正文 | 阶段目标清楚 | 阶段收口卡 |
| product-analyst | 定义目标、范围、非目标、验收口径 | 需求卡 / 生产版本目标卡 | 不替架构定技术实现 | 需求门禁 | 验收标准 |
| architect | 定义技术边界、数据流、接口、风险 | 技术卡 / 设计方案 | 不替产品扩范围 | 方案门禁 | 架构说明 |
| frontend-ui-designer | 定义页面模式、交互、状态、UI 契约 | 交互卡 / UI 执行契约 | 不直接编码、不堆页面 | UI 门禁 | 线框 / 视觉证据要求 |
| programmer | 按契约实现并验证 | 实现结果卡 | 不擅自改方案或沿用旧反模式 | 开发门禁 | 测试 / 截图 / 命令结果 |
| diagnostician | 过程诊断 | 诊断报告 | 不最终验收、不优化岗位 | 诊断结论 | findings / KPI 候选 |
| reviewer | 最终验收 | 验收卡 | 不替开发补实现 | 验收门禁 | 验收证据 |
| HR | 周期治理 | HR 治理报告 | 不参与单次门禁裁决 | 周期评估 | KPI 汇总 |

## Stage Gates

- 需求确认：
- 技术方案确认：
- UI / 交互确认：
- 开发完成：
- 诊断完成：
- 验收完成：

## Evidence Requirements

- 文档证据：
- 代码 / 配置证据：
- UI 视觉证据：
- 验证命令：
- 外部审计证据：

## Drift Risks

- 诊断到执行可能断裂：
- 旧风格 / 旧架构可能保留：
- 岗位越界风险：
- 证据不足风险：

## KPI Recording Rules

- 记录条件：
- 严重级别口径：
- 是否纳入 HR 周期复盘：
