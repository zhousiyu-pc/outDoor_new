# CI/CD Process

## ADDED Requirements

### Requirement: Pull request validation is repeatable and isolated

The project SHALL run the documented Java, Python Agent, Mini Program, governance, and cross-service checks in an isolated CI job without production credentials, production databases, or production writes.

#### Scenario: Pull request checks run

- **WHEN** a pull request is opened, updated, or reopened
- **THEN** the required checks run against the pull request commit and publish pass/fail results and test logs
- **AND** a failed required check prevents merge until it is rerun successfully or explicitly superseded by a reviewed change

#### Scenario: CI cannot reach production

- **WHEN** a pull request job executes
- **THEN** it uses temporary test data, temporary tokens, and isolated loopback services
- **AND** it has no production secret, production database, or production deployment permission

### Requirement: Build outputs are traceable and immutable

The project SHALL identify Java and Python Agent container outputs by source commit and OCI digest, and SHALL retain the associated test, SBOM, and scan evidence for each release candidate.

#### Scenario: Candidate image is built

- **WHEN** a reviewed commit is merged to the release branch
- **THEN** Java and Agent images are built from the reviewed source and tagged with the full commit SHA
- **AND** the resulting digest, source commit, build run, tests, SBOM, and scan result are recorded together

#### Scenario: Deployment selects an image

- **WHEN** a staging or production deployment is approved
- **THEN** the deployment selects an already verified image digest
- **AND** it does not use `latest` or rebuild source on the target server

### Requirement: Production and Mini Program release remain protected

The project SHALL require explicit approval and runtime evidence before production server deployment or Mini Program release, and SHALL preserve application, database, privacy, and native-device gates.

#### Scenario: Production deployment is requested

- **WHEN** a production deployment is requested
- **THEN** a protected environment requires an authorized approval after code review, QA, post-execution diagnosis, reviewer, backup, health probe, and rollback checks
- **AND** the deployment does not disable `productionReady` or production startup protections

#### Scenario: Mini Program release is requested

- **WHEN** a Mini Program experience or production release is requested
- **THEN** the release records the package version, uploader, device acceptance, privacy/platform status, and rollback path
- **AND** the release is not implicitly triggered by a backend deployment
