## Why

一期产品核心是用户输入一句自然语言诉求，但首页此前仍以多项结构化筛选和快捷标签为主要视觉入口，导致产品承诺与实际交互不一致，阻塞人工验收。

## What Changes

- 将首页主入口改为单一自然语言诉求输入框。
- 将出发地和时间降级为辅助上下文入口。
- 保留高级筛选，但不作为默认主路径。
- 在结果页保留来源、采集时间和采纳动作。
- 调整首页文案，使其明确表达“一句话找可靠路线”。

## Capabilities

### New Capabilities
- `single-sentence-route-query`: 用户通过一句自然语言诉求发起路线参考。

### Modified Capabilities
- `miniprogram-field-guide-ui`: 首页信息层级从筛选表单改为单句输入优先。

## Impact

影响 `miniprogram/pages/index/index.wxml`、`index.wxss` 和本 change 治理证据。不修改后端契约、推荐逻辑、数据库或部署配置。
