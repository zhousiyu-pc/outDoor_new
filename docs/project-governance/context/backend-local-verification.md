# 本地验证记录

日期：2026-09-29；执行者：总控。实际命令证据摘要，不代替独立 QA。

## 已执行

- `mvn -o -f backend-java/pom.xml test -q`：exit 0，JUnit/MockMvc/H2 11 项通过。测试日志为 JDK 24.0.2，shell 默认 Java 为 23.0.2，字节码目标 17；未在真实 Java 17 运行。
- `node --test miniprogram/tests/backend-contract.cjs`：初轮 16 项通过；分享修复后的 17 项由开发与独立 code-reviewer 复跑通过。
- `PYTHONDONTWRITEBYTECODE=1 RUN_AGENT_HTTP_TESTS=1 python3 -m unittest discover -s agent-python/tests -v`：exit 0，16 项全部通过，包含临时 loopback 端口的并发请求与令牌拒绝。
- `python3 scripts/run_phase_one_smoke.py --skip-build`：exit 0。使用已离线构建的 Boot JAR，动态 loopback 端口、临时 H2、临时内部令牌；不访问已有数据库或外部来源。

## Smoke 输出

```text
PASS default no-source result, identical replay and changed-body conflict
PASS minimal private submission and truthful map degradation
PASS H2 file persistence across Java restart
PASS explicit preview search/detail and rejection of formal adoption
phase-one smoke: PASS; owned processes stopped and temporary database removed
```

首跑发现 smoke 工具自身使用 Request.method 导致 AttributeError；已改为 Request.get_method() 并重跑通过。失败发生在 Agent health 检查，未涉及既有数据库。

## 当前门禁

代码审查首轮发现分享 ID、跨语言输入边界和来源 URL 参数问题；分享已修复，其他修复进行中。修复后需重新 package、执行受影响回归，再进入 QA、diagnostician、reviewer。以上不证明真实 MySQL、真实来源、生产身份或微信真机已验收。原型视觉未在本轮修改。
