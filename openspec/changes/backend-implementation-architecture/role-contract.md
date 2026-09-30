# 角色交接契约

| 角色 | 产物 | 边界 |
|---|---|---|
| product-analyst | 当前原型后端能力范围和验收口径 | 不决定框架和表结构 |
| architect | 本设计、服务边界、契约、数据流和分期 | 不直接实现代码 |
| programmer | 按 B0/B1 切片实现和自测 | 不安装依赖、改真实数据库或部署 |
| code-reviewer | 事务、权限、幂等、来源边界和代码级审查 | 不替开发扩范围 |
| qa | API 契约、故障、数据污染和回归测试 | 不把 mock 结果当真实来源验收 |
| diagnostician | 检查实施是否偏离设计和用户原型闭环 | 不代替 reviewer |
| reviewer | 独立判断设计证据是否足够进入实施/人工验收 | 不替代数据库和部署授权 |

2026-09-29：用户“可以，继续”已授权本地 B0/B1 实现。当前按开发自测 → 独立 code-reviewer → QA → post-execution diagnostician → reviewer 推进；真实 MySQL、来源接入与部署不以本地测试替代。
