# Diagnostic State

diagnostic_required: true
pre_execution: skipped
post_execution: pending
pre_report: ../../../../docs/project-governance/backend-execution-baseline.md
post_report: diagnostic-post.md
skip_reason: 执行前由已接受架构、文档入口分诊与执行基线反向思考完成范围和风险判断，未单派独立 pre diagnostician；跨服务实现后必须独立诊断，不能据此跳过 post。

当前状态：实现与代码审查中；post-execution diagnosis 触发为 required。

触发依据：Java/Python/小程序契约变更、持久化与幂等事务、预览真实性、用户历史多次指出验证与实际行为不一致。诊断应核对独立代码审查、QA、H2/真实 MySQL 边界、HTTP 实测与微信真机边界，再进入 reviewer。
