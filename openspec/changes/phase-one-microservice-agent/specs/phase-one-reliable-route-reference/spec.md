## ADDED Requirements

### Requirement: Natural language route reference
The system SHALL allow a Mini Program user to submit one natural-language outdoor route request and receive candidate route references.

#### Scenario: Candidate route references are returned
- **WHEN** the user submits a natural-language request
- **THEN** the system returns candidate route references with source, collected time, and match reasons

### Requirement: Candidate before adoption
The system SHALL treat routes fetched from external platforms or Skills as candidate references until the user explicitly adopts them.

#### Scenario: Candidate is not persisted as formal asset
- **WHEN** a candidate route is returned but the user does not adopt it
- **THEN** the system does not persist it as a formal route asset

### Requirement: Explicit adoption creates formal asset
The system SHALL only create a formal route asset when the user explicitly adopts a candidate route.

#### Scenario: User adopts candidate
- **WHEN** the user clicks an explicit adopt action for a candidate
- **THEN** the system creates a formal route asset linked to the original candidate and source evidence
