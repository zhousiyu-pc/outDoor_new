# Java Business API — B0/B1 local implementation

Java 17 target / Spring Boot 3.2.5 / Jackson / JDBC. The API now persists search requests, candidates, source evidence, ordered result snapshots, adoption, feedback, submissions and events in transactions. The old `PhaseOneBusinessServer` delegates to the new entry point; it no longer serves fabricated fallback routes or writes JSONL.

## Build and run offline

Run from the repository root, using already cached Maven dependencies:

```bash
mvn -o -f backend-java/pom.xml test
mvn -o -f backend-java/pom.xml package
PORT=18080 AGENT_BASE_URL=http://127.0.0.1:19081 java -jar backend-java/target/outdoor-business-0.1.0.jar
```

The default Spring `local` profile binds **127.0.0.1** and creates `./runtime-data/business.mv.db` relative to the process working directory. To isolate the local database:

```bash
LOCAL_DB_URL='jdbc:h2:file:/private/tmp/outdoor-business-test/business;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_ON_EXIT=FALSE;LOCK_TIMEOUT=3000' java -jar backend-java/target/outdoor-business-0.1.0.jar
```

`schema-local.sql` initializes only the local H2 schema. No command here applies SQL to MySQL. `mvn -o -Pmysql -DskipTests package` builds without the H2 runtime dependency, but needs all dependencies already cached. Maven/Java installations were not changed. The bytecode targets Java 17; the local tests also work on the existing newer JDK using Mockito's subclass mock maker, without a self-attach agent.

## Runtime boundaries

- **This is local/test functionality, not production-ready authentication.** Anonymous sessions are only attribution, ownership and idempotency keys, not verified identities. An attacker who knows a session string can impersonate it. Bind to loopback until real identity, authorization and gateway abuse controls exist.
- `production` profile fails startup. `mysql` profile also fails unless `APP_ALLOW_UNAUTHENTICATED_TEST_DATABASE=true` explicitly acknowledges a non-production test database. Both guards are deliberate launch blockers; removing them is not a configuration workaround for deployment.
- MySQL requires `SPRING_PROFILES_ACTIVE=mysql`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `AGENT_BASE_URL` and the above test-only acknowledgement. Automatic SQL initialization is **off**. Schema approval/application is a separate operation.
- The draft at `database/mysql/migrations/V001__business_baseline_draft.sql` targets a **fresh dedicated database**. It is not an incremental migration of `phase_one_schema.sql`. Existing rows/schema need a reviewed upgrade/backfill plan. H2 tests do not establish MySQL migration compatibility or production readiness.
- `BIND_ADDRESS` defaults to loopback. The Dockerfile is a packaging draft for an already built JAR; image building/pulling/deployment has not been performed. Configure the Agent via a service address when running separate containers.

## Contract

Every POST requires `X-Anonymous-Session-Id` (or `anonymousSessionId` in JSON) and `Idempotency-Key` (or `clientRequestId`). Keys are scoped by session + operation. Matching replays return the original status/body/IDs; a different body with the same key returns `409 IDEMPOTENCY_CONFLICT`. Canonical and legacy aliases share an operation scope. Generated request/candidate/asset IDs cannot be supplied by the Agent.

| Method | Canonical path | Result |
| --- | --- | --- |
| GET | `/health` | Database availability and `productionReady:false` |
| POST | `/api/v1/user/search/recommendations` | `requestId,status,items,warnings` |
| GET | `/api/v1/user/candidates/{id}` | `{ok:true,plan}` from persistent candidate snapshot |
| GET | `/api/v1/user/routes/{id}` | `{ok:true,plan}` with `routeAssetId` |
| POST | `/api/v1/user/routes/adoptions` | `routeAssetId,adoptionId,candidateId,requestId,status:ADOPTED` |
| POST | `/api/v1/user/search/events` | `eventId,status:RECORDED,persistedAsFormalAsset:false` |
| POST | `/api/v1/user/route-feedback` | `feedbackId,status:RECEIVED` |
| POST | `/api/v1/user/route-submissions` | `submissionId,status:REVIEW_PENDING` |
| POST | `/api/v1/map/reverse-geocode` | `status:DEGRADED,label,provider:null` until an authorized map provider exists |

Search accepts nested `origin`, `preferences`, `departureTime`, `sourcePolicy` plus existing flat fields. Strings, arrays, coordinate ranges and payload sizes are bounded. Unsupported coordinates are omitted before calling the Agent. Nested fields are allow-listed; arbitrary properties cannot replace server IDs or leak sessions to the Agent. Query is limited to 120 characters. Provider calls receive a correlation ID but no anonymous session or idempotency key.

Search status is `READY`, `NO_SEARCH_RESULTS` or `DEGRADED`. The default Agent without a source returns an empty result; timeouts return empty degraded results. Partial upstream failure remains `DEGRADED` even with useful results. Explicit Agent demo results stay `previewOnly:true` and are not adoptable. Candidate responses always include `id,candidateId,requestId,sourceEvidence,rawRef,routeStats,geo,matchReasons,missingItems,riskWarnings,previewOnly`.

Cross-service input limits match Agent: origin label/city/source 120/80/80 characters, drive limit 1–1440 minutes, source limit 1–50, supported longitude 73–135 and latitude 3–54. Flat city/source/policy fields map into canonical nested fields with nested precedence. Departure picker metadata `userSelected` is removed before Agent calls.

Adoption body: `requestId,candidateId`. Within a transaction, the candidate is locked and checked for request/session ownership, expiry, status and non-mock source evidence. Candidate uniqueness plus `(candidate_id,session_id)` adoption uniqueness prevents duplicates across different keys. Asset creation, adoption event, history and idempotency response commit together. Search/events/feedback/submissions never create a route asset. New assets have `recommendation_enabled=false` pending source/governance decisions.

Feedback body: `requestId,candidateId,tags,note,shareExperience` for an owned candidate, or `routeAssetId,tags,note,shareExperience` for a public adopted asset. Candidate feedback needs its original request/session. Shared public assets permit viewer feedback; a carried original `requestId` is ignored instead of claiming ownership of another person's search. At least one tag or note is required. Feedback does not edit route facts.

Submission body: required `title,startPoint`, optional `endPoint,tags,note,shareExperience` (boolean). Points can be a name string or `{name,address?,lng?,lat?}`. Private notes and sharing intent persist only in submission/feedback tables, with no public retrieval endpoint. Submissions enter `REVIEW_PENDING` and are never published automatically.

Event body: `requestId,eventType,candidateId?,routeAssetId?`; `type` and `resultItemId` remain compatibility aliases. References must belong to the same request/session. Additional event payloads are intentionally not persisted.

Public details return a field allow-list from candidate snapshots; they do not return query/session/private notes or arbitrary provider payloads. Source URLs omit query strings and fragments in both search and detail, including rawRef evidence. `/api/v1/user/recommendation/{id}` looks up either kind. `/api/user/...`, `POST /user/routes`, and `/user/routes/{id}/feedback` (including old by-shortline alias) are migration paths, with the same validation and idempotency rules.

Errors use `{ok:false,error:{code,message,retryable},requestId,correlationId}` with an appropriate HTTP status. Invalid JSON, unknown endpoints, unsupported methods and persistence failures are not reported as successful writes.

## Agent resilience and remaining gates

`AGENT_BASE_URL` points to `POST /v1/route-candidates`; optional `AGENT_SERVICE_TOKEN` becomes a bearer token. Calls have a 1,200 ms total wait, four workers, queue capacity eight, bounded response bytes and a ten-second breaker after three failures. No retries invent candidates. The request transaction stays open during this bounded call; scale testing and upstream admission control are still B3 work.

The local limiter caps each session at 120 POSTs/minute and bounds the session map. It is neither production authentication nor a distributed/global rate limiter. Existing local sessions and their candidates can be lost if local storage is removed; no production retention/deletion process has been implemented.

JUnit/MockMvc/H2 tests cover full criteria forwarding, reserved-field isolation, share details without client cache, candidate/asset separation, idempotency conflict/retry, same/different-key concurrency, unknown/cross-session/expired/disabled/mock rejection, source expiry, feedback/submission/event storage, input/method/body limits, public-asset feedback and truthful no-source/timeout/map degradation. Real source integration, authenticated identity, MySQL execution/rollback, actual Java 17 runtime and deployment acceptance remain separate gates.
