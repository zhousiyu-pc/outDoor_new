# UI Mode Card：H5 Demo Mobile

## Baseline and source

- Direct adoption: `outdoor-recommendation-exploration/DESIGN.md`
- Design baseline: local `design-md-style-library` Apple mobile pattern, already translated in the H5 demo
- Platform: WeChat Mini Program
- Pages: home, results, route detail, correction / route sharing

## Project tokens

| Token | Value | Use |
|---|---|---|
| Canvas | `#F5F7F2` + low-opacity sky/grass/water gradients | Page background |
| Warm surface | `#FBFAF6` | Route and form cards |
| Ink | `#15231E` | Main copy |
| Muted ink | `#617069` | Supporting copy |
| Forest | `#176B4E` | Main action and selected state |
| Forest dark | `#0E382B` | Trust surface |
| Clay | `#D47745` | Provenance and changeable information |
| Sun / water | `#E9B35D` / `#76A8AA` | Restrained route-scene accents |
| Border | `#DFE6DE` | Card and control boundary |

Use white or warm-white cards with fine borders, small card radii, and pill controls. Avoid external imagery, fonts, and dependencies.

## Page mapping

| H5 principle | Mini Program page |
|---|---|
| One-sentence task comes first | Home input and primary search action |
| Provenance is easy to scan | Result card source, time, fit facts, reason, and uncertainty |
| Decision information is staged | Detail: fit and departure → map → schedule and risks → feedback |
| Short, clear form | Correction or route-sharing form with existing fields and controls |
| Contextual navigation | Use page-level back links and action links; avoid a persistent bottom bar that competes with the main task |
| H5 sample preview route | Omitted; Mini Program uses real recommendation payloads |
| Outdoor scene field | CSS-only gradients behind the content surfaces; no images or external assets |

The Mini Program uses the H5 demo's compact brand/location header and reserves the system status/capsule area. Page-level links use existing page paths; no browser-only route state or mock content is copied.

## Acceptance

- Home keeps the single-sentence entry and existing search logic.
- Results expose title, facts, reason, source/time, uncertainty, and existing actions.
- Detail exposes departure decision, map, schedule, risks, favorite, and feedback.
- Feedback keeps both correction and route-sharing modes.
- At 390px-class width there is no horizontal overflow; primary actions and page headers avoid the WeChat capsule and safe-area insets.
- Visual acceptance is completed in WeChat Developer Tools or on a device; static checks alone cannot close it.

## Native cascade adaptation

The v2 184px button selector must be overridden by page + control classes, not a single class/global button reset. Preserve intrinsic prompt/tag widths, full-width search/grid/sheet controls and selected variants. Deliberate line breaks use native block views. 84 compiler-output cases passed at 320/390/430px in both native CSS orders; this supports the layout correction only and does not close the native acceptance requirements above.
