## ADDED Requirements

### Requirement: Mini Program uses the field guide visual mode

The Mini Program user-facing pages MUST use the project-specific paper, forest, clay, ink, and water visual tokens derived from `outdoor-recommendation-exploration/DESIGN.md`.

#### Scenario: User opens the home page

- **WHEN** the home page renders
- **THEN** the user sees a quiet field-guide style hero with a clear primary action and no dense white dashboard treatment

### Requirement: Recommendation decisions remain scannable

The results and detail pages MUST keep route title, fit signal, facts, reason, source, uncertainty, and primary actions visually distinguishable.

#### Scenario: User reviews a recommendation

- **WHEN** a recommendation card is rendered
- **THEN** the user can identify why it was recommended, what facts are known, what needs confirmation, and how to open details

### Requirement: Existing user behaviors remain available

The UI refactor MUST preserve route search, origin selection, departure selection, recommendation fallback, favorite, map, feedback, and upload-route actions.

#### Scenario: Remote recommendation is unavailable

- **WHEN** the remote recommendation request fails
- **THEN** the existing local fallback still renders through the refactored result surface

### Requirement: Small-screen layout remains usable

The refactored pages MUST not introduce horizontal overflow and MUST keep primary controls reachable on a 390px-class viewport.

#### Scenario: User opens the result page on a narrow screen

- **WHEN** the viewport is narrow
- **THEN** cards stack vertically, controls wrap or scroll safely, and no primary action is clipped
