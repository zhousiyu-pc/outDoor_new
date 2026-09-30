# 实施任务清单

## B0 契约冻结

- [ ] 冻结 `RecommendationRequest`、候选、详情、采纳、事件、反馈、贡献和地图 schema
- [ ] 统一 `/api/v1` canonical 路径和错误码
- [ ] 完整透传首页当前全部搜索条件
- [ ] 增加 `clientRequestId` / `Idempotency-Key`，禁止副作用 POST 盲目重试
- [ ] 增加统一 correlationId、超时和 Agent 调用线程池

## B1 Java + MySQL

- [ ] 选择并授权生产框架和 JSON 库
- [ ] 建立 request/candidate/result/source/asset/adoption/event/feedback/submission Repository
- [ ] 完成采纳事务、唯一约束和状态历史
- [ ] 实现详情、反向地理编码、纠错和用户补充路线接口
- [ ] 将 JSONL fallback 降级为本地迁移输入

## B2 Python Agent

- [ ] 结构化意图解析和 Connector 接口
- [ ] 来源证据 schema 校验、去重和排序
- [ ] 首个明确授权来源接入
- [ ] 超时、失败、降级和 Agent 运行审计

## B3 / B4 验收与部署

- [ ] 指标、日志、限流、来源过期和冲突治理
- [ ] 契约、幂等、污染防护和故障降级测试
- [ ] 分别构建 Java/Agent 镜像并配置云内服务地址
- [ ] 测试 MySQL migration、回滚和小程序冷启动路径
- [ ] 通过 code-review、QA、diagnostic、reviewer 后再申请数据库/依赖/部署授权
