# 小程序 Field Guide UI 重构模块

状态：active  
模块：`miniprogram-field-guide-ui`  
当前 change：`miniprogram-h5-demo-ui-translation`

## 当前需求

将 `outdoor-recommendation-exploration/DESIGN.md` 及已评审 H5 demo 的 mobile 视觉转译到微信小程序首页、结果、详情和反馈页，保持现有业务行为和页面路径。

## 文档引用

- [proposal](../../../../../openspec/changes/miniprogram-h5-demo-ui-translation/proposal.md)
- [spec](../../../../../openspec/changes/miniprogram-h5-demo-ui-translation/specs/miniprogram-field-guide-ui/spec.md)
- [design](../../../../../openspec/changes/miniprogram-h5-demo-ui-translation/design.md)
- [UI Mode Card](../../../ui-mode-card.md)

## 非目标

不包含业务页面 JS、后端 API、数据库、Agent、后台管理端和部署改造。详情页为接入 H5 风格共享 shell，可以增加不改变业务语义的页面跳转 glue。
