# UI 执行基线锁定卡

状态：active  
change：`miniprogram-field-guide-ui-refactor`

## 锁定范围

1. 修改小程序 `app.wxss`、四个页面 WXML/WXSS、必要的详情页 shell 跳转 glue、客户端 `apiClient.js` 归一化、UI 治理文档和本 change 证据。
2. 保留后端 API 契约、存储、页面路径、收藏、地图、反馈和 fallback 行为。
3. 视觉来源限于 `outdoor-recommendation-exploration/DESIGN.md` 的项目化转译。
4. 不新增依赖、不修改后端/数据库、不部署、不执行 Git commit/push。

## 停止条件

- 需要修改后端 API 契约或数据结构才能完成 UI；
- 需要新增图片、字体、npm 依赖或外部资源；
- 发现页面功能行为和视觉重构无法兼容。

## 通过条件

- UI Mode Card 和 OpenSpec readiness 通过；
- 页面资源和 JS 依赖静态检查通过；
- 首页、结果、详情、反馈无明显横向溢出；
- fallback、收藏、地图、反馈主路径仍有实现证据；
- reviewer 通过，真实微信开发者工具留人工验收。
