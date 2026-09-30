## ADDED Requirements

### Requirement: WeChat project structure is complete

The project MUST provide a valid WeChat Mini Program configuration and every page listed in `miniprogram/app.json` MUST have its `.js`, `.json`, `.wxml`, and `.wxss` files.

#### Scenario: Developer tool loads the project

- **WHEN** the project root is opened in WeChat Developer Tools
- **THEN** the tool can resolve the configured Mini Program root and all configured page entry files

### Requirement: Local recommendation fallback is available

The Mini Program MUST provide a local recommendation fallback so the core journey can render a result without a successful remote API call.

#### Scenario: Remote recommendation is unavailable

- **WHEN** the recommendation request fails or is unavailable
- **THEN** the results flow can use local recommendation plans and render a non-empty result state

### Requirement: Page-local dependencies are resolvable

All relative `require` calls used by Mini Program pages and utilities MUST resolve to files within the project.

#### Scenario: Static dependency check runs

- **WHEN** a repository-local dependency scan checks relative JavaScript imports
- **THEN** no referenced local JavaScript module is missing
