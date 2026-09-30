# Backend developer check — B0/B1 local implementation

Date: 2026-09-29
Scope: `backend-java/**`, `database/mysql/**`; this review correction also records its handoff here.

## Implemented and validated

- Spring Boot/Jackson/JDBC implementation persists requests, candidate/source/result snapshots, adoption/assets, events, feedback, submissions, history and idempotency in H2 locally. MySQL schema is an unexecuted fresh-database draft.
- Adoption validates ownership, expiry, status and evidence under a candidate lock. Same/different idempotency keys return the same asset/adoption after concurrent requests. Preview/mock candidates cannot create assets.
- Public snapshots use allow-listed fields. Search, detail and rawRef evidence URLs drop query strings and fragments; detail sanitization also protects older stored snapshots. No query/session/private feedback or submission notes are public.
- Agent failures do not create synthetic candidates. Useful results with an upstream `DEGRADED` status remain degraded, preserving warnings rather than being reported as `READY`.

## Independent-review corrections

- Origin `label/city/source` limits are now 120/80/80 Unicode code points, matching Python. Flat `city/source/originLabel` and `originPoint.longitude/latitude` map into canonical origin; nested fields take precedence.
- `driveLimitMinutes` is 1–1440; `sourcePolicy.limit` is 1–50. Java response item validation accepts the same maximum. Flat policy switches/limit are mapped with nested precedence.
- Search coordinates require finite numeric pairs within geographic bounds. Supported points are 73–135 longitude and 3–54 latitude; valid unsupported points are removed before Agent calls. Candidate geo follows the same support bounds.
- Optional search preference values reject invalid null/type values, empty list items and malformed Unicode before Agent calls; `companions/activityType` are retained. Query validation honors explicit query precedence rather than hiding an empty query behind a legacy alias.
- Departure limits match Agent mode/iso/timezone/date/time/label (80/64/64/10/8/120). ISO values require offsets. Mini Program picker-only `userSelected` is stripped while preserving the actual selected time; other unknown departure fields are rejected.
- Session and idempotency keys remain solely in the Java business boundary, not forwarded to Agent. Public request IDs remain in the current approved candidate contract; removing that correlation field is not part of this correction.

## Evidence

- `mvn -o -f backend-java/pom.xml package -q` — PASS after review corrections.
- `BusinessApiTest`: 14 tests, 0 failures/errors/skips. Includes URL redaction in search/source/result snapshots and cold detail, partial connector degradation, early rejection before Agent invocation, concurrency, persistence and private-field exclusion.
- `RequestContractTest`: 5 tests, 0 failures/errors/skips. Covers boundary matrices, legacy/nested field precedence, finite coordinates, invalid null/type fields, Unicode, source flags and actual client custom-departure shape.
- Reports: `backend-java/target/surefire-reports/`; local command log: `/private/tmp/outdoor-java-review-tests.log`. Tests use existing JDK 24 and Java 17 bytecode target; actual Java 17 runtime acceptance remains open.

## Objective judgment and handoff

No remaining blocker found within this local implementation/self-test scope. The review findings had concrete compatibility/privacy effects and were fixed without expanding product behavior. Local unit/MockMvc/H2 checks do not prove live MySQL or production readiness.

Route back to code-reviewer for reread, then QA. Cross-service contract/persistence changes trigger post-execution diagnosis; no direct reviewer bypass. Production auth, real source integration, MySQL apply/rollback, deployment and end-to-end environment acceptance remain gated. No dependency installation, network fetch, MySQL migration, deployment or Git operation was performed.
