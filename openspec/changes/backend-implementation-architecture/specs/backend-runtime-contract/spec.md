## ADDED Requirements

### Requirement: Prototype request fields are preserved
The business API SHALL validate and persist query, origin, departure time, age, duration, difficulty, transport, drive limit, scene preferences, safety needs, source policy, and anonymous session attribution. It SHALL forward recommendation criteria to the Agent without forwarding the session or idempotency key. Nested criteria SHALL take precedence over legacy flat aliases, and explicit preferences SHALL take precedence over text inference.

#### Scenario: Search criteria reach the recommendation boundary
- **WHEN** the Mini Program submits structured preferences
- **THEN** Java stores the request criteria and session attribution and passes the same recommendation criteria to the Agent without silently dropping fields

### Requirement: Candidate evidence is explicit
The response SHALL include candidate identity, source evidence, collected time, match reasons, route facts, map data when available, and uncertainty fields. Java SHALL own business candidate and asset identifiers.

#### Scenario: Candidate is displayed with traceable evidence
- **WHEN** an authorized source connector returns a route reference
- **THEN** the response includes source evidence and marks missing or stale facts for confirmation

### Requirement: Empty results and failures are truthful
A normal search with no configured provider or no matches SHALL return `NO_SEARCH_RESULTS` and an empty list. Provider errors, timeouts or evidence degradation SHALL be identified as `DEGRADED`. Demo data SHALL require an explicit non-production switch and be marked `LOCAL_PREVIEW`, `MOCK`, and `previewOnly:true`.

#### Scenario: No provider is configured
- **WHEN** the default Agent runs without a real source
- **THEN** it returns an empty successful result with `SOURCE_NOT_CONFIGURED` and does not fabricate external routes

#### Scenario: Demo data is displayed
- **WHEN** explicit demo mode returns a preview candidate
- **THEN** Java rejects its adoption and does not create a formal route asset

### Requirement: Formal assets require explicit adoption
Java SHALL create an asset only after explicit adoption of an active, unexpired candidate belonging to the submitted request and session, with valid non-mock evidence. The asset, adoption event, history and idempotency response SHALL commit together. Adoption SHALL not automatically enable public recommendation.

#### Scenario: Repeated adoption is idempotent
- **WHEN** the same adoption body is retried with the same session, operation and key
- **THEN** the API returns its original status, body and asset identifier without creating another asset

#### Scenario: Different keys target the same candidate
- **WHEN** concurrent adoption requests use different keys for the same owned candidate
- **THEN** candidate and candidate/session uniqueness still prevent duplicate formal assets or adoption records

### Requirement: Idempotency is scoped and conflict aware
POST idempotency SHALL use `(session, operation, key)`, with a request hash and stored response. Canonical and legacy aliases for one action SHALL share the same operation scope. A reused key with a different body in that scope SHALL return `409 IDEMPOTENCY_CONFLICT`.

#### Scenario: Unrelated sessions or operations reuse a key
- **WHEN** a key is also used by a different session or operation
- **THEN** it does not replay or conflict with another scope's result

### Requirement: Candidate and asset details are distinct
The API SHALL expose `GET /api/v1/user/candidates/{candidateId}` and `GET /api/v1/user/routes/{routeAssetId}` separately. Shared details SHALL expose only public route fields, excluding query, session and private notes.

#### Scenario: Shared detail opens without a client cache
- **WHEN** a viewer opens a known candidate or asset identifier
- **THEN** the appropriate endpoint reads its persistent snapshot and preserves its candidate or asset identity

### Requirement: Feedback respects reference ownership
Candidate feedback SHALL require the original request and session. Public adopted-asset feedback SHALL allow viewers to submit without owning the original search. Feedback SHALL append a `RECEIVED` record and SHALL NOT change route facts directly.

#### Scenario: Candidate feedback belongs to another search
- **WHEN** the candidate does not belong to the submitted request and session
- **THEN** the API rejects the feedback

#### Scenario: A viewer reports a shared public asset
- **WHEN** a viewer supplies an existing routeAssetId with feedback content
- **THEN** Java records feedback under the viewer session without claiming ownership of the original search

### Requirement: Route submissions have a minimal pending contract
A submission SHALL require only `title` and `startPoint` as route content. End point, tags, note and sharing intent SHALL be optional. Submissions SHALL enter `REVIEW_PENDING` and SHALL NOT publish a candidate or formal asset automatically.

#### Scenario: User submits a minimal route clue
- **WHEN** valid title and startPoint are provided with session and idempotency metadata
- **THEN** the API persists a pending submission and returns its submissionId

### Requirement: Map degradation is explicit
Reverse geocoding SHALL expose provider availability truthfully and SHALL NOT fabricate a resolved location.

#### Scenario: No map provider is configured
- **WHEN** the client requests reverse geocoding
- **THEN** the API returns `DEGRADED`, a usable fallback label and `provider:null`

### Requirement: Agent cannot publish formal assets
The Agent SHALL return structured candidates and evidence but SHALL NOT write business databases or change adoption status.

#### Scenario: Agent returns candidates
- **WHEN** Java invokes the Agent
- **THEN** Java validates and persists the output and the Agent has no formal-asset write credentials

### Requirement: Search budgets and deployment boundaries are explicit
The current client search budget SHALL default to 5000 ms including retries; Java's Agent wait SHALL default to 1200 ms; the Agent Connector budget SHALL default to 1000 ms. Production deployments SHALL use explicit service addresses and authenticated identities rather than assuming Java loopback or trusting an anonymous session string.

#### Scenario: Agent service is unavailable
- **WHEN** the Agent exceeds its deadline or cannot be reached
- **THEN** Java returns a traceable degraded response without fabricated sources

### Requirement: Local persistence is not production acceptance
The current Spring Boot/JDBC/H2 implementation SHALL remain a local/test baseline. The Python runtime SHALL remain standard-library based unless separately changed. MySQL schema execution, migration/rollback, real sources, trusted identity and production deployment SHALL require their own evidence and gates.

#### Scenario: Local database tests pass
- **WHEN** H2 transaction and contract tests succeed
- **THEN** the result is recorded as local evidence and SHALL NOT be treated as MySQL or production acceptance
