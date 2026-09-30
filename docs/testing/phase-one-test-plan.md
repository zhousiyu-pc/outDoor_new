# 测试计划：一期可靠路线参考

日期：2026-09-24  
主导岗位：qa  
状态：v1 / 本轮测试输入

## 1. 测试范围

- Java 业务服务健康检查；
- Python Agent 健康检查；
- 一句诉求生成候选路线；
- 候选包含来源、时间和匹配理由；
- 用户采纳候选；
- 采纳后生成正式路线资产记录；
- 未采纳候选不进入正式资产；
- 小程序 JS 静态语法检查。

## 2. 不测试

- 微信云真实部署；
- 真实 MySQL 写入；
- 真实外部平台 API；
- 微信开发者工具真机渲染。

## 3. 本地验证命令

```bash
python3 scripts/check_phase_one_docs.py
python3 scripts/run_phase_one_smoke.py
find miniprogram -name '*.js' -print0 | xargs -0 -n1 node --check
```

## 4. 人工验收

- 打开微信开发者工具；
- 首页输入一句诉求；
- 查看候选路线；
- 点击采纳路线；
- 确认采纳成功提示。
