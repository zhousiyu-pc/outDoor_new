# QA report

## Current conclusion

2026-09-26: the complete H5 demo translation is implemented across the four Mini Program pages. The native button-width defect remains covered by the earlier before/after regression, and the new home context card, detail support panels, and shared bottom navigation compile with the current WXML/WXSS. Execution mode is `fallback_local_only` (same agent); no independent QA or full WeChat runtime pass is claimed.

2026-09-28: structural simplification pass completed after user feedback. Home now contains one input, three examples, one compact context row, and collapsed filters; results remove duplicate source strips; detail merges confirmation content; feedback is single-column; persistent bottom navigation is removed. Action labels stay short and provenance/pre-departure warnings remain visible. All four WXML files were compiled with the installed `wcc`, all page/app WXSS files with `wcsc`, and all WXML event bindings resolve to page methods.

2026-09-28: outdoor canvas and client-adapter pass completed. Home/results/detail/feedback now use low-opacity sky, water, grass, or warm-light gradients with readable white content surfaces. `apiClient.js` unwraps compatible `data` envelopes, accepts candidate list/source/coordinate aliases, and maps them into the existing plan fields. Backend endpoints and request payloads remain unchanged.

2026-09-28: final H5-to-Mini Program alignment pass completed after the user's runtime comparison. The home template now renders the demo's compact brand lockup, `周末去哪` / `找条合适的路` heading, white intent card, horizontal prompt chips, and forest-green CTA. Results, detail, and feedback now use the same compact brand header and card hierarchy; the results heading is `选一条去走`. The old `brand-mark` headers were removed from those pages. No API, storage, page path, map, favorite, adoption, or feedback handler changed.

## Test plan and coverage

Use the installed WeChat wcc/wcsc compiler to generate all four WXML trees and page/app CSS. Mount the compiler output in isolated mobile Chromium with the exact installed v2 button width/margin selector. Block all network requests. Use real page initial data and existing project fallback data only as test fixtures.

| Cases | Widths / order | Assertions |
|---|---|---|
| Old home | 320 / 390 / 430px | Search and six prompts are 184px; prompts occupy six rows |
| Home, active prompt, advanced filters, home sheet | Three widths × native CSS first/last | Search fills card, prompt rows shared, intrinsic widths, native title line break |
| Results, adopted result, empty result | Same matrix | No horizontal overflow; adopted background remains dark forest |
| Detail, saved detail, time sheet, missing route | Same matrix | No horizontal overflow; sheet/quick buttons fit; saved state remains clay |
| Feedback, selected feedback tag, route upload | Same matrix | No horizontal overflow; tags intrinsic width; selected background forest |

### Full translation additions (2026-09-26)

| Surface | Assertion |
|---|---|
| Home context card | Origin and departure picker bindings remain present and values render from existing `originDisplayName` / `departureSummary` data |
| Detail support panels | Route rhythm, `dataLimit`, and checklist / fallback preparation content render from `travelPlanView` and `carryItems` |
| Detail shell | Bottom navigation methods exist and map only to `/pages/index/index`, `/pages/results/results`, and `/pages/feedback/feedback?mode=upload` |
| Four-page shell | Shared H5 tokens, compact brand/location header, contextual actions, and safe-area padding compile without adding assets or dependencies |

## Execution and regression

- 3 pre-fix reproductions plus **84 post-fix layouts (14 states × 3 widths × 2 stylesheet orders)**: PASS.
- At 320 / 390 / 430px, search width changed from 184px to **276 / 330 / 364px**, exactly the input card content width. At 390px, six prompt rows became two.
- WXML/WXSS compilation, all Mini Program JS syntax, JSON parsing and 20/6/11/8 distinct page-event method checks: PASS.
- OpenSpec strict validation, external dev-team document-baseline check (0 warnings), phase-one document check: PASS.
- Backend smoke is a prior-turn PASS; it was not repeated for this CSS/WXML-only correction, and does not substantiate UI correctness.
- Full translation pass additionally recompiled all four WXML files and the combined page/app WXSS after adding the context, detail support, and navigation shell. The current structural pass recompiled the reduced files again (`wcc` 74,371 bytes; `wcsc` 31,292 bytes); native IDE/device acceptance remains open.
- The 84-case browser layout matrix was completed before this structural pass. The current pass was verified with JavaScript syntax, JSON parsing, event binding and tag-balance checks, `wcc`/`wcsc`, and document gates; the browser process was unavailable in this environment for a new screenshot matrix.
- The final outdoor canvas and adapter pass compiled all four WXML files and app/page WXSS with `wcc`/`wcsc`; the adapter fixture passed. A backend smoke rerun was attempted but the sandbox rejected local port binding with `Operation not permitted`, so live service behavior remains open. Native visual, contrast, safe-area, keyboard and touch acceptance also remains open.
- Final alignment verification: `wcc` compiled all four page templates (`77,123` bytes). `wcsc` compiled `app.wxss` plus all four page WXSS with `pageCount: 5` (including the feedback page); compiler output lengths were app `208`, index `8,774`, results `7,582`, detail `7,729`, feedback `5,116` bytes, with no compiler errors. The earlier `pageCount: 4` batch omitted the last page stylesheet from its returned object; the feedback stylesheet was then compiled separately and passed.
- Static checks after the alignment pass: all page JavaScript syntax, WXML tag stacks, WXSS brace balance, JSON parsing, and page event bindings pass. Native WeChat rendering still needs the user's Developer Tools/device screenshot for final visual acceptance.

## Defect log

| ID | Finding | Resolution |
|---|---|---|
| UI-BTN-01 | Native selector outranks prior global/single-class widths | Page-scoped button rules; old/new native CSS reproduction passes |
| UI-TITLE-01 | HTML br does not provide supported Mini Program block layout | Two native view blocks; compiled tree geometry checks two lines |
| HARNESS-01 | Desktop screen.orientation caused 844px rpx conversion at a 320px viewport | Explicit mobile portrait context, per-case document navigation; assert orientation and screen width; rerun entire matrix |
| DOC-01 | current.md used ambiguous ../../docs references | Project-root docs references; baseline check now passes |

## Evidence and limitations

- `evidence/button-layout-regression.json`: measurements, colors, orientation and source SHA-256 values.
- `evidence/check-layout.cjs`, `native-v2-button.css`, `button-fix.patch`, `source-checks.txt`, `validation.txt`: test method and source/check evidence.
- `button-layout-before.png`, `button-layout-after.png`, `home-after-width-fix.png`: compiled-output browser captures, **not WeChat IDE/device screenshots**. Image output was generated; the current tool transport did not expose the image to the model, so no pixel-by-pixel visual review is asserted.
- The harness emulates only the required wx element display and native button width/margins, not the complete native component stack. Safe area, capsule, native textarea/keyboard, scrolling/touch targets and native API flows remain unverified.
- WeChat IDE CLI service is disabled. That does not prevent compiler/CSS verification and is not evidence that the user's compile directory or cache is wrong.
- The four screenshots in `evidence/` show translated surfaces in the isolated compiler harness; they are not a substitute for the user's WeChat Developer Tools preview.

## Reverse-thinking card

No blocking failure remains in the declared matrix. The strengthened selectors could have broken active colors; explicit color assertions passed. Proceed to local diagnosis/scope review for this correction while leaving independent review and full native acceptance open.
