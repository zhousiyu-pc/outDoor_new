## MODIFIED Requirements

### Requirement: Mini Program uses the reviewed H5 mobile visual mode

The Mini Program home, results, detail, and feedback pages MUST use the project tokens and information hierarchy in `outdoor-recommendation-exploration/DESIGN.md`, translated for WeChat Mini Program layout and existing data.

#### Scenario: User reviews route references

- **WHEN** the results page renders route references
- **THEN** the user can distinguish each route's title, fit facts, reason, source and collection time, uncertainty, and available actions

#### Scenario: User checks route details

- **WHEN** the route detail page renders
- **THEN** route fit and departure information appear before map entry, schedule, risks, and feedback
- **AND** the page exposes route rhythm, data limits, and available preparation items when those fields exist

#### Scenario: User opens the feedback page

- **WHEN** correction or route-sharing mode renders
- **THEN** the route context, fields or issue tags, optional note, sharing choice, and submit action remain clear and reachable

### Requirement: Existing Mini Program behavior remains available

The visual translation MUST preserve the existing page paths, event handlers, data fields, page-based navigation, recommendation fallback, source information, favorite, adoption, map, feedback, route sharing, and departure-time controls.

#### Scenario: H5 demo contains sample routes or browser-only destinations

- **WHEN** the H5 demo's visual patterns are translated
- **THEN** static demo route content is not copied, and any bottom navigation points only to existing Mini Program page paths

#### Scenario: Page uses custom navigation chrome

- **WHEN** a Mini Program page renders its own header
- **THEN** the content reserves the system status area and WeChat capsule space, and the page header remains reachable below them
