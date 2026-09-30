# Role Contract

## Change / Module

`miniprogram-h5-demo-ui-translation` / 小程序 H5 视觉转译

## Global Goal

Translate the user-reviewed H5 demo's visual mode into the Mini Program's four existing pages without changing business behavior or using demo route data.

| Role | Must Do | Must Produce | Must Not Do |
|---|---|---|---|
| tech-director | Control scope, gates, and closeout | Intake and handoff decision | Expand into backend or deployment |
| product-analyst | Keep route decision and feedback outcomes intact | Value and acceptance criteria | Change route policy or adoption semantics |
| frontend-ui-designer | Translate H5 DESIGN.md into native page patterns | UI contract and mappings | Copy browser-only tabs or brand assets |
| programmer | Update WXML/WXSS/JSON and bounded shell-navigation glue, then self-check | Page implementation | Change business page JS, API, storage, or recommendation rules |
| code-reviewer | Check correctness, compatibility, and scope | Review record | Treat static checks as device acceptance |
| qa | Check structure, bindings, and existing fallbacks | QA report | Claim unrun device checks passed |
| diagnostician | Check execution drift and evidence gaps | Post-execution diagnosis | Replace reviewer judgment |
| reviewer | Assess completion independently | Reviewer record | Convert pending human preview into a pass |

## Role Boundaries

- The tech director owns intake, scope, gates, and the final bounded status.
- The frontend/UI role owns the H5-to-WXSS mapping and color hierarchy; it does not change route policy.
- The programmer may change page WXSS/WXML and the client adapter's compatibility normalization; it may not change backend contracts or persistence semantics.
- QA and reviewer must keep static/compiler evidence separate from native WeChat and live-service acceptance.

## Stage Gates

1. Intake and design mapping must identify the H5 reference, the single-task page flow, the outdoor color translation, and the API compatibility boundary.
2. Implementation must preserve page paths, event handlers, request methods, and user-facing uncertainty behavior.
3. Code review and QA must run JS/JSON/WXML/WXSS checks plus the adapter fixture; live smoke and native preview remain explicit open gates.
4. Post-execution diagnosis must record any drift or evidence gap before reviewer closeout.

## Evidence Requirements

- `wcc` compiles all four page templates and `wcsc` compiles app/page stylesheets.
- `node --check` passes all Mini Program JS and a fixture proves nested response/source/coordinate normalization.
- Document baseline and phase-one checks pass with zero warnings; backend smoke is recorded as pass or environment-blocked.
- No screenshot or static result is described as native WeChat device acceptance.

## Drift Risks

- A stronger outdoor background could compete with route facts or lower contrast on small screens.
- A new backend response shape could bypass the bounded aliases and silently fall back to neutral labels.
- Browser/compiler checks can miss safe-area, capsule, keyboard, scrolling, touch, and live cloud-container behavior.

## KPI Recording Rules

- Record a KPI candidate only for confirmed process failure or repeated user feedback with evidence; do not create a KPI event for ordinary approval or a blocked smoke caused by sandbox policy.
- Keep the existing `fallback_local_only` label when independent role dispatch or native preview is unavailable.
- Do not mark the change fully accepted while native visual, live API, or independent review gates remain open.

## Evidence Boundaries

- H5 `DESIGN.md` is the source for visual tokens and patterns.
- Mini Program JS remains the source for fields, behavior, and real route data.
- WeChat Developer Tools or device preview is required to close safe-area and touch-layout acceptance.

## Execution mode

The 2026-09-26 full-translation pass follows the accepted product/architecture/UI direction and expands the implementation from a button-only correction to the complete H5 page journey. The current tool returned `unsupported call: spawn_agent` on role dispatch. Code review, QA, diagnosis and closeout therefore use explicitly labeled `fallback_local_only` evidence; none is an independent sign-off. An independent review and native visual/interaction acceptance remain pending.
