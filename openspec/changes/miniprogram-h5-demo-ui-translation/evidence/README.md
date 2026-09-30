# Button cascade regression evidence

These captures render actual WeChat WXML/WXSS compiler output in mobile Chromium with the installed 3.15.2 button width/margin selector. They are **not** WeChat IDE/device captures. Network is blocked; existing route fixtures are used only for layout testing.

Run with the local installed Node and toolchain:

```sh
node openspec/changes/miniprogram-h5-demo-ui-translation/evidence/check-layout.cjs
```

The script contains the local installed WeChat compiler, Playwright and Chrome paths; no package installation is needed on this machine. Pre-fix sources are at `/private/tmp/miniprogram-ui-regression/before` for this run. `MINIPROGRAM_UI_BASELINE_ROOT` may point to another directory containing a `before` snapshot. The temporary baseline is not a permanent project dependency. `button-fix.patch` preserves the source delta, and the JSON report fingerprints the current page sources.

Native CSS source: local WeChat 3.15.2 wxvpkg `/WAWebview.js`, extracted read-only under `/private/tmp/miniprogram-ui-regression`. Only the relevant rule fragment is retained here.

The test covers 3 before cases and 84 after cases. The assertions include portrait/rpx calibration, widths/row wrapping, title block placement, horizontal overflow, sheet fit and selected/adopted/saved colors. The current full-UI source also includes the home context card, detail route rhythm / information boundary / preparation panels, and a supported detail shell navigation. It does not emulate the full native component stack, keyboard, safe area, capsule, touch or API flows.
