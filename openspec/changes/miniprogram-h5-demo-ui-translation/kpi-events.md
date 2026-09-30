# KPI Events

## Events

- ID: UI-NATIVE-CASCADE-20260925
- Status: confirmed local candidate; not submitted to global governance/kpi/index.jsonl.
- User evidence: “小程序重新编译出来的样式，还是没有变化”, following the earlier screenshot sizing complaint.
- Objective problem: prior correction used lower-specificity CSS and was described as fixed after only static checks; the native 184px rule continued to win.
- Impact: repeated user recompilation and feedback without resolving the reported layout.
- Category: verification insufficient / premature completion wording.
- Corrective action: recover native selector, reproduce before state, validate compiled trees/styles in both CSS orders, test selected colors, qualify native-runtime limits.
- Evidence: qa-report.md, diagnostic-post.md, evidence/button-layout-regression.json.
- Scope: no personnel score or general capability claim is inferred from this single incident. No formal .codex runtime or external ledger write.
