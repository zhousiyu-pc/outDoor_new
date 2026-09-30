# Code review

## 2026-09-25 repeated-feedback correction

Review mode: `fallback_local_only`. An explicit attempt to dispatch the code-reviewer returned `unsupported call: spawn_agent`; this record is a same-agent local review, not an independent sign-off. The earlier unconditional PASS is superseded by this scoped result.

## Scope and findings

- Compared every file in the pre-correction Mini Program snapshot with the current tree. Exactly four page WXSS files and two page WXML files changed. JS, JSON, API/storage helpers and route data in that snapshot are byte-identical. See `evidence/button-fix.patch` and `source-checks.txt`.
- Confirmed the actual installed WeChat 3.15.2 rule: `wx-button:not([size=mini])` sets width 184px and auto horizontal margins. Its specificity `(0,1,1)` exceeds a single class `(0,1,0)` and global `button` `(0,0,1)`. The previous fix could not override it.
- `.page .control` has specificity `(0,2,0)` and wins regardless of source order. All button classes in the four pages were inspected: prompt/tag/link controls use automatic widths, search/option/grid/sheet controls use full container/track widths, result and bottom actions retain flex sizing. All buttons remain descendants of `.page`, including sheets.
- Active, adopted and decision-panel overrides were scoped with the base rules so selected colors continue winning.
- Replaced unsupported HTML `br` nodes with native block views for the home headline and detail art label. No events or data bindings were removed.
- Event-handler presence: home 20, results 6, detail 11, feedback 8; all target existing JS methods. Syntax/JSON checks passed.

## Verdict and reverse-thinking card

Code gate: `conditional_pass / fallback_local_only`; no blocking defect found in this six-file correction. Increasing specificity can suppress state variants, so QA must measure selected/adopted colors as well as geometry. Compilation alone cannot prove the fix; compare old/new output with the native selector and both CSS orders. Full WeChat visual/interaction acceptance and independent review remain open.

## 2026-09-28 H5 structure alignment re-entry

This follow-up review covers the current source after the user's screenshot comparison. The current delta is limited to `miniprogram/app.wxss`, the four page WXML files, and the four page WXSS files. The four page JavaScript files, JSON, API client, storage helpers, route data, and page paths remain outside this pass.

- Home now uses the H5 compact brand lockup, task heading, intent card, prompt row, compact context row, and collapsed filters.
- Results, detail, and feedback use the shared brand header; the old `brand-mark` header markup is absent from the four pages.
- Existing event binding names remain present and resolve to the existing page methods; no business behavior was removed.
- `wcc` and `wcsc` compile the current source. `wcsc` uses `pageCount: 5` for the global stylesheet plus four page styles so the feedback stylesheet is included in the returned compiler object.

Verdict: `conditional_pass / fallback_local_only`. The H5 structure is now present in the actual `miniprogram/` source tree. Native safe-area, capsule, keyboard, touch, and screenshot acceptance remain open and are not claimed here.
