# Role Contract

## Change / Module

`miniprogram-single-sentence-input` / 小程序一句话输入首页

## Role Boundaries

| Role | Must Do | Must Produce | Must Not Do |
|---|---|---|---|
| tech-director | 判断产品/UI不一致并门禁 | 回退与收口结论 | 不跳过人工视觉验收 |
| product-analyst | 固化一句话输入目标 | 一期范围口径 | 不改技术契约 |
| frontend-ui-designer | 重排信息层级 | UI设计决策 | 不改变推荐业务 |
| programmer | 修改WXML/WXSS并自测 | 页面实现 | 不修改后端或数据库 |
| qa | 做静态和人工视觉验证 | QA记录 | 不把静态通过当真机通过 |
| reviewer | 独立终审 | 验收结论 | 不替代微信开发者工具验收 |

## Gate

静态检查通过后，状态为 `ready_for_human_acceptance`，必须由用户在微信开发者工具中确认视觉和交互。
