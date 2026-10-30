# CI/CD 实施任务

## 入口和方案

- [x] 1.1 完成 required 文档驱动入口、范围、非目标、验收标准和反向思考卡。
- [x] 1.2 固化 PR CI、产物、staging、生产和小程序发布边界。

## 前置修复

- [x] 2.1 修复并锁定 Python 3.12 依赖组合，生成 `agent-python/requirements.lock.txt`；隔离环境 98 项全量测试通过。
- [x] 2.2 校准隔离 smoke 的示例请求以符合 LangGraph 活动意图契约；明确徒步请求复跑通过。
- [x] 2.3 将文档基线和目标治理检查固定为 CI 可运行入口，不依赖开发机绝对路径。
- [ ] 2.4 固定 WXML/WXSS 编译工具版本、来源和许可边界。

## CI 实现

- [x] 3.1 新增只读 PR workflow，运行 Java、Python、Node、文档、OpenSpec 和无推送容器构建；尚未在 GitHub 上启用 required check。
- [x] 3.2 为 CI 添加构建缓存和 Java/Python/Node/smoke 失败日志留存；GitHub required checks 与分支保护尚未在远程启用。
- [ ] 3.3 增加 Java/Agent commit-SHA 镜像、SBOM 和漏洞扫描产物，不推生产标签。

## CD 实现

- [ ] 4.1 明确私有镜像仓库、staging 环境、secret store 和发布责任人。
- [ ] 4.2 实现 digest 固定的手动 staging 部署、健康检查和应用回滚。
- [ ] 4.3 在生产身份、MySQL 回滚、观测和人工门禁完成后，再评估 protected production workflow。
- [ ] 4.4 单独定义微信体验版和正式版人工发布记录，不自动提交平台审核。

## 收口

- [x] 5.1 独立 code-review、QA、post-execution diagnosis 和 reviewer 已完成，结论为 conditional_pass；远程 runner 证据仍待补齐。
- [ ] 5.2 更新项目治理 current/context/handoff，并由技术总监判断是否启用下一阶段。
