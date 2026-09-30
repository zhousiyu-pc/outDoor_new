# 2026-09-25 小程序按钮回归交接

- 当前 change：`miniprogram-h5-demo-ui-translation`。
- 用户反馈：重新编译后样式仍无变化；本轮继续已授权的 H5 UI 转译缺陷修复。
- 文档驱动入口：`required`，沿用现有 proposal/design/UI 模式卡，不重开需求与设计方向。产品/架构/UI 契约不变；本轮是明确根因的 WXML/WXSS 兼容性返工。
- 根因证据：本机微信基础库 3.15.2 的 `/WAWebview.js` 中存在 `wx-button:not([size=mini]) { margin-left: auto; margin-right: auto; width: 184px; }`。单类选择器和全局 `button` 重置优先级不足；无证据认定缓存或用户编译目录有误。
- 修复：四页按钮规则增加 `.page` 作用域，提高优先级，并为胶囊按钮、满宽 CTA、等宽网格按钮分别明确宽度和边距；首页与详情图案的 `<br />` 改为原生块级 view。
- 本轮修改前快照：`/private/tmp/miniprogram-ui-regression/before/`。本轮仅修改四页 WXSS、两页 WXML；页面 JS/API/存储/后端不变。
- 自测：使用本机开发者工具 `wcc/wcsc` 编译，再加载编译树/CSS 与确切原生按钮规则到隔离 Chromium，测试 320/390/430px。测试脚本 `/private/tmp/miniprogram-ui-regression/check-layout.cjs`，网络请求全部拦截。
- 当前自测：3 个旧版复现与 84 个新版布局/状态断言 PASS。首轮 detail-missing 溢出是测试浏览器横屏 rpx 转换错误，已改移动端竖屏、隔离文档并加入校准断言；未为此改产品样式。结果在 change 的 `evidence/`。
- 原生运行时边界：此 harness 不是微信完整渲染器，不证明键盘、胶囊、安全区和原生 API 交互通过。
- 本轮岗位：programmer 开发自测 → code-reviewer → qa → diagnostician → reviewer → 总控验收判断。前次同主控静态复核不能冒充独立审查，旧记录需由本轮证据覆盖。

## 反向思考卡

- 客观问题：前次静态检查虽通过，却未验证原生 CSS 的级联，错误地描述按钮宽度已修复；用户重复负反馈提供反证。
- 补充建议：必须先能重现旧版，再证明编译后的新版改变测量结果，同时核查选中态与同类按钮；不要把重新编译/清缓存当作无证据的解决方案。
- 下一步：编译产物自测异常已闭环，可报告局部修复；独立子代理调用返回 unsupported，本轮记录仅为 fallback_local_only，独立审查与完整原生验收仍未完成。
- 边界风险：完整 H5 视觉一致性、安全区与真实微信交互仍需原生预览；本轮布局证据只覆盖列明的选择器、状态与屏幕宽度。
- KPI 候选：重复缺陷反馈 + 验证不足/完成判断过早，待 diagnostician 确认并在项目内记录，不写正式 `.codex` 或全局 ledger。
