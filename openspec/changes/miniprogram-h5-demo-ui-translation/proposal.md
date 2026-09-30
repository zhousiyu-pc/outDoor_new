## Intake

- Document-driven trigger: `required`
- Reason: this is a complete redesign of the Mini Program's four user-facing pages and navigation shell.
- User value: make it easier to express an outing need, compare route evidence, decide whether to go, and correct information.
- Business value: strengthen the route adoption and feedback loop through clearer source and uncertainty cues.
- Product loop: home request → route references → route detail and departure decision → adoption, map, or feedback.
- Non-goals: no backend API, recommendation rule, storage, route adoption, database, deployment, or backend service change. Client-side response normalization may be adjusted when it preserves the existing backend contract.
- Scope simplification: use the user-reviewed H5 demo and its `DESIGN.md` as the accepted direction; translate its patterns into existing Mini Program fields and page navigation.

## Why

The user-facing Mini Program pages still use the earlier paper/olive palette and dense numbered panels, while the reviewed H5 demo establishes a clearer mobile hierarchy with a single input, visible provenance, and staged route decisions. The Mini Program should carry that direction through its home, results, detail, and feedback journey while keeping the actual Mini Program data and behavior authoritative.

## What Changes

- Apply the H5 demo's canvas, ink, forest, clay, surface, border, and pill-control tokens to the Mini Program shell and four pages.
- Use the page headers already present in WXML as the primary navigation chrome, reserve room for the WeChat status area and capsule, and align native page backgrounds with the new palette.
- Rework result, detail, and feedback hierarchy and component surfaces to match the H5 demo's route-card, decision, and form patterns.
- Keep the H5 demo's quiet brand/location header, while removing persistent bottom navigation that competes with the primary task on small screens.
- Reduce each page to one clear next action: enter a request, choose a route, confirm departure facts, or submit a short correction/share form.
- Preserve existing WXML event handlers, page data models, backend API paths, request methods, storage behavior, page paths, map, favorite, adoption, correction, and route-sharing flows. The client adapter may unwrap compatible response envelopes and field aliases before the existing view models consume them.
- Add a restrained outdoor color field to the four pages using WXSS gradients only: sky/water on home and results, green/earth on detail, and warm light on feedback. Keep the content surfaces white or translucent white for clear reading.
- Do not bring H5 mock route data or browser-only route content into the Mini Program; the translated navigation must use existing Mini Program paths.

## Capabilities

### Modified Capabilities

- `miniprogram-field-guide-ui`: update the visual contract to the reviewed H5 demo's mobile design and direct adoption map.

## Impact

The change is limited to `miniprogram/app.wxss`, four page JSON/WXML/WXSS files, the client adapter in `miniprogram/utils/apiClient.js`, a small amount of detail-page shell navigation glue, and governance evidence. Backend endpoints, storage, dependencies, database, and route semantics remain outside scope.

## Repeated-feedback intake

2026-09-25: user reports recompilation leaves the same layout. Trigger remains `required`; this is bounded corrective work inside the approved UI translation. Existing product, architecture and DESIGN.md contracts are reused. No new feature, redesign direction, data or API change is authorized by this correction.

2026-09-26: user clarified that the requested result is a complete translation of the H5 demo rather than a button-only correction. Scope is expanded back to the full four-page visual journey and shared mobile shell. This adds the home context card, detail route-rhythm / information-boundary surfaces, detail shell navigation, and matching governance evidence; business payloads and route semantics remain unchanged.

2026-09-28: user clarified that the four-page UI still felt crowded and copy-heavy. Scope is refined toward structural simplification: remove repeated support/preview panels, persistent bottom navigation, duplicate source notices, and long explanatory blocks while retaining the existing route facts, source, uncertainty, picker, map, adoption, favorite, correction, and sharing actions.

2026-09-28: user requested a more colorful outdoor background and allowed client API refactoring. Scope adds CSS-only outdoor gradients and a bounded adapter refactor for nested response envelopes, source evidence aliases, coordinate aliases, and detail payloads. Backend endpoints, request methods, storage, and route semantics remain unchanged.
