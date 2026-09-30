## Context

The reference is `outdoor-recommendation-exploration/DESIGN.md` and its H5 implementation. The design baseline is the local `design-md-style-library` Apple mobile pattern, translated into the project's own outdoor identity. The Mini Program keeps its real route payloads and its page-based navigation.

## Product Design

- Main user outcome: understand why a route may fit, what is known, what could change, and what action is available before leaving.
- Preserve the loop: one-sentence request → route references → route detail and departure decision → adoption, map, or feedback.
- Do not imply trust through decoration alone. Keep source and collection time visible, and keep uncertainty and pre-departure checks explicit.

## Goals / Non-Goals

**Goals:**

- Make the four Mini Program pages feel like a clean, colorful outdoor tool while keeping one clear action per page.
- Preserve route facts, source evidence, uncertainty, map, favorite, adoption, feedback, and route-sharing behavior.
- Make compatible response envelopes and source/coordinate aliases render through the existing page view models.

**Non-Goals:**

- No backend endpoint, request payload, recommendation rule, database, storage model, dependency, or deployment change.
- No H5 mock route data, external imagery, external fonts, or browser-only navigation.
- No claim of native WeChat visual, keyboard, touch, or live-service acceptance from static compilation.

## Decisions

1. Use CSS-only gradients for sky, water, grass, and warm-light atmosphere; keep the foreground cards white or translucent white so the route decision stays legible.
2. Keep forest green as the primary action color and clay as the provenance/change cue; do not add a new brand palette.
3. Put response unwrapping and field aliases in `apiClient.js`, then pass stable `plans`, `mapAction`, `facilityCards`, and `decisionFacts` into the existing pages.
4. Treat missing or unknown fields as `待确认` / `出发前看一眼`, and only expose the map action when numeric coordinates are available.

## UI Mode Card

| H5 principle | Mini Program translation |
| --- | --- |
| UI chrome recedes | Use a compact brand/location header; keep navigation contextual so it does not compete with the main action. |
| One clear action | Keep the home search as the strongest action and route adoption as the result-card action. |
| Forest action color | Use forest green for primary actions and selected states; clay only for provenance and changeable information. |
| Parchment / white rhythm | Use a cool field canvas, white or warm-white surfaces, fine green-gray borders, and small consistent radii. |
| Product tile is the focal object | Give route cards a restrained geometric scene above title, facts, reason, source, and actions. |
| Staged decision | Detail pages lead with route and current departure fit, then map entry, schedule, risks, and feedback. |
| Progressive disclosure | Keep optional filters behind one link and reveal only the next decision on each page. |

## Direct Adoption

```text
Canvas       #F5F7F2
Warm surface #FBFAF6
Ink          #15231E
Muted ink    #617069
Forest       #176B4E
Forest dark  #0E382B
Clay         #D47745
Sun          #E9B35D
Water        #76A8AA
Border       #DFE6DE
Cards        8px-equivalent radius
Controls     pill radius
```

- `text-input` → single-sentence Mini Program textarea and existing form fields.
- `button-primary` → full-width forest pill for search and submit actions.
- `card-content` → route, context, decision, and feedback surfaces with restrained borders.
- `card-feature-dark` → trust and decision surfaces only where existing fields support the content.
- `badge-positive` → source, match, saved, adopted, or current status labels using existing data.
- H5 preview route → not copied because its route is static demo data and the Mini Program must show real recommendation data.
- H5 scene colors → translated into CSS-only sky, grass, water, and warm-light gradients on the page canvas; no image or external asset is introduced.
- H5 route payloads → consumed through the existing Mini Program adapter, with bounded unwrapping for compatible response envelopes and source/coordinate aliases.

## Page Structure

1. Home: one-sentence input → three examples → compact origin/time row → optional filters.
2. Results: query recap → three filters and search → route cards with facts, reason, warning, and detail/adoption actions.
3. Detail: route identity → three facts → one pre-departure list → short schedule → feedback/map/favorite actions.
4. Feedback: mode title → route context → fields/tags/note → sharing choice → submit.
5. Shared shell: compact brand/location header with contextual back and action links; no persistent navigation bar.

## Reverse-Thinking Card

- Counterpoint: the H5 demo uses static sample routes and browser navigation; copying those pieces could make real route data look guaranteed or create dead navigation in the Mini Program.
- Evidence: the demo handoff explicitly labels its routes as mock data. The Mini Program has four supported page paths, so any contextual link must point only to those paths.
- Decision: adopt the visual tokens and staged information rhythm; keep existing payloads, route actions, and uncertainty language. Remove persistent navigation when it adds a competing action on small screens.
- Boundary risk: custom page headers and sheets still depend on safe-area layout and must be checked in WeChat Developer Tools on a real device size. Reserve the status/capsule area in WXSS; record this as a human visual acceptance item if that runtime is unavailable.

## Risks / Trade-offs

- Mini Program WXSS differs from browser CSS. Use simple gradients, shapes, flex/grid rules already used by the project, and no external assets or runtime CSS variables.
- Custom navigation can collide with the status area or WeChat capsule. Reserve `env(safe-area-inset-top)` plus the native capsule row and keep page headers below it.
- Static checks cannot prove touch targets, scrolling, or safe-area rendering. Require WeChat Developer Tools or device preview for final visual acceptance.

## Outdoor canvas and adapter reverse-thinking card

- Counterpoint: adding color can make the page decorative and compete with the route decision; client-side aliases can also hide a backend contract drift.
- Evidence: gradients stay behind the existing content cards, and the adapter only accepts known envelope/list/source/coordinate aliases before falling back to the existing neutral labels.
- Decision: use low-opacity gradients, keep facts/source/warnings in the foreground, and leave backend paths and request payloads unchanged.
- Boundary risk: the gradients and translucent surfaces still need native WXSS rendering and contrast review on actual device sizes; a live response with a new unknown schema still requires backend contract work.

## Native button correction and reverse-thinking card

- Evidence: installed 3.15.2 native `wx-button:not([size=mini])` specifies 184px with auto margins. The earlier single-class/global resets could not win.
- Mapping: intrinsic pill/link buttons use `.page .control { width:auto; margin:0; }`; primary search and grid/sheet controls declare full track width; flex actions retain their allocation. State selectors carry the same scope. Native block views supply deliberate headline/art-label line breaks.
- Counter-risk: increased specificity can suppress active variants. Selected/adopted/saved backgrounds are checked in both CSS load orders.
- Decision: no blocker in the 84 measured cases. This verifies the cascade correction, while native safe area, keyboard and complete visual acceptance remain open.
