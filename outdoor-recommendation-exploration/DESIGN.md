# 野去 H5 Demo · UI Mode Card

## UI context

- Target: responsive H5 demo for the WeChat Mini Program redesign.
- Product type: consumer mobile recommendation and decision tool.
- Primary task: say what kind of outing is wanted, compare a few route references, then decide.
- Reference baseline: local `design-md-style-library` catalog, `apple` mobile DESIGN.md.

## Why this baseline fits

The selected baseline gives the demo a quiet, task-led rhythm: one clear input, low-noise chrome, strong typography, and information revealed in steps. The project keeps its own outdoor identity through forest green, clay, sun and water colors. No Apple brand name, logo, exact copy, proprietary imagery or blue accent is copied.

## Direct adoption mapping

| Baseline rule | Project translation |
| --- | --- |
| UI chrome recedes | Small top bar with brand, location and one utility control; no dense tab bar on desktop. |
| Strong display type | Large Chinese headings are used only at the start of each view. Body copy stays compact. |
| Single action color | Forest green carries primary actions and selected states; clay is reserved for warnings and provenance. |
| Parchment / white rhythm | Cool field canvas, white input surfaces and warm route preview sections create quiet separation. |
| Pill actions and compact utilities | Search, filter, location and adoption actions use pill geometry; repeated cards use 8px radius. |
| Product tile as focal object | Route cards use a low-detail field illustration area so title, source and facts remain primary. |
| Responsive mobile shell | Desktop uses a two-column content grid; under 620px it becomes one column with contextual page actions and no persistent navigation. |

## Project tokens

```text
Canvas: #F5F7F2
Warm surface: #FBFAF6
Ink: #15231E
Muted ink: #617069
Forest action: #176B4E
Forest dark: #0E382B
Clay notice: #D47745
Sun: #E9B35D
Water: #76A8AA
Border: #DFE6DE
Card radius: 8px
Control radius: 999px
```

## Page pattern

1. Home: one-sentence input → three examples → one search action. Origin and time stay compact and optional.
2. Results: query recap → filters → a short route list with source, fit reason and uncertain facts.
3. Detail: route identity → three decision facts → one pre-departure list → short schedule → actions.
4. Feedback: route context → issue tags → optional note → share preference → submit.

## States

- Loading is represented by the same stable layout rather than shifting content.
- Uncertain information uses `待确认` / `出发前看一眼`, never a fabricated guarantee.
- Saved routes use the filled heart state and a toast.
- Adopted routes use `已加入` and stay visually distinct from mere favorites.
- Empty search results explain the next action and expose a reset control.
- Keyboard focus keeps a high-contrast clay ring.

## Old style pollution check

- Removed the former marketing-style hero and multi-section discovery page from the demo.
- Removed weather sticker language, field-guide numbering as the primary visual device, and decorative mountain-heavy composition.
- No external font, image, npm dependency, brand asset or third-party tracker is used.

## Evidence required

- Desktop: home input is the first visual action; result cards remain readable at two columns.
- Mobile: input, CTA, route facts and contextual back/actions remain reachable without horizontal scroll.
- Interaction: examples fill the input, search enters results, filters change cards, save/adopt update state, detail and feedback return correctly.
