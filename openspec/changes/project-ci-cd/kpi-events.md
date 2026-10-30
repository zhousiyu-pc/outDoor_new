# KPI Events

## Events

| Event | Meaning | Boundary |
|---|---|---|
| `CI_PIPELINE_RESULT` | 一次 PR 或 main CI 的阶段结果、耗时和失败类型 | 只记录 job 状态、提交 SHA 和聚合耗时，不记录 secrets、用户数据或 provider 原文 |
| `BUILD_ARTIFACT_TRACE` | 源提交与测试日志、镜像 digest、SBOM/扫描结果的关联 | 只记录不可变身份和证据地址，不把密钥写入 artifact |
| `RELEASE_GATE_DECISION` | staging/production/微信发布门禁是否满足 | 记录审批岗位、门禁状态和回滚责任，不等同于自动发布 |
| `CI_GOVERNANCE_DRIFT` | 治理文件、required check 或证据链缺失 | 先作为 candidate 交给 diagnostician，不能由“继续”自动升级 |

## Role Performance KPI Candidate Review

- Candidate：本 change 的 target governance readiness 在实现后首次运行时暴露契约缺项，后续补齐并复验。
- Evidence：`check-target-governance.py --change project-ci-cd` 的首次结果为 `contract_incomplete`；影响范围限于本地治理证据，无生产或用户数据影响。
- Routing：交给 post-execution diagnostician 判断是否进入项目或全局 ledger；不追认实现前已通过。
