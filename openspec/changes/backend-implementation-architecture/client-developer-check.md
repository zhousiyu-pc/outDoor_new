# Client and local-integration developer check

Date: 2026-09-29  
Scope: Mini Program API contract alignment plus isolated Java/Agent local smoke harness.

## Change mapping

| Area | Files | Contract covered |
| --- | --- | --- |
| Mini Program transport | `miniprogram/utils/apiClient.js` | `/api/v1` canonical paths, session headers/body, request correlation, idempotency, bounded transport retry, candidate/asset detail, feedback target XOR |
| Mini Program persistence | `miniprogram/utils/journeyStore.js` | pending write keys, adoption persistence, draft feedback, restart-safe local state |
| Mini Program pages | `miniprogram/pages/results/results.js`, `plan-detail/plan-detail.js`, `feedback/feedback.js` | explicit preview gate, true detail refresh, adopted asset state, asset-first share links, truthful failure state |
| Client contract tests | `miniprogram/tests/backend-contract.cjs` | mocked `wx` transport, cold detail, retries, conflicts, adoption, feedback drafts, preview fail-closed, share-to-asset feedback, explicit-empty preference preservation |
| Local integration | `scripts/run_phase_one_smoke.py` | isolated Boot + Agent processes, dynamic loopback ports, temporary H2, no-source behavior, idempotency, submission/map degradation, restart persistence, explicit demo rejection |
| Runtime docs | `README.md`, `infra/wx-cloudrun/README.md`, `infra/wx-cloudrun/Dockerfile` | local-only boundary, verified JAR entry, production gates, Docker context/port parity |

## Contract self-check

- Explicit empty scene and safety selections remain empty through local persistence and search request construction; only missing or non-array inputs use defaults.
- Canonical writes use `/api/v1`; the client does not replay HTTP failures through path aliases.
- A transport retry keeps the same request body, `clientRequestId`, `Idempotency-Key`, `X-Request-ID`, and anonymous session.
- Every write includes `anonymousSessionId` in the JSON body and `X-Anonymous-Session-Id` in the request header.
- Candidate feedback retains `requestId` for original request ownership. Public adopted-asset feedback sends only `routeAssetId` and does not assert the viewer's request ownership.
- Search events carry explicit `candidateId` and `routeAssetId` where known.
- Candidate detail is fetched from the server even when a cached search result exists. `cand_*` and `route_*` identifiers select the appropriate cold-start endpoint.
- Adoption writes `routeAssetId` and `isAdopted` to local state; local favorites remain separate from adoption.
- Failed feedback or submissions remain a `DRAFT` and show a local-only retry message. A tracking event cannot masquerade as feedback success.
- Preview results require explicit non-release `previewMode`; release rejects preview details and formal adoption.
- Adopted route share paths prefer `routeAssetId`, allowing a new session to cold-start the public asset and submit asset-only feedback.

## Verification facts

Executed locally without installing dependencies, binding ports, starting services, changing databases, or deploying:

```text
node --test miniprogram/tests/backend-contract.cjs
19 tests passed

node --check miniprogram/utils/apiClient.js
node --check miniprogram/utils/journeyStore.js
node --check miniprogram/pages/results/results.js
node --check miniprogram/pages/plan-detail/plan-detail.js
node --check miniprogram/pages/feedback/feedback.js
all passed

python3 AST parse of scripts/run_phase_one_smoke.py
passed

python3 scripts/run_phase_one_smoke.py --help
passed; no service started
```

The full Boot + Agent smoke test is intentionally not claimed as executed in this sandbox because it binds loopback ports and launches Spring/Python processes. Run it on an authorized local environment after the offline JAR build:

```bash
mvn -o -f backend-java/pom.xml package
python3 scripts/run_phase_one_smoke.py --skip-build
```

The smoke harness owns only its `Popen` handles, uses a dynamically allocated loopback port for each process, creates a fresh temporary H2 file, generates a temporary Agent token, and removes the temporary directory on exit. It does not inspect or mutate an existing database.

## Remaining gates

Real source providers, verified user identity and authorization, MySQL migration/rollback, production gateway controls, observability, image build and deployment remain incomplete. The local smoke harness and H2 tests do not establish those production gates.

## Confirmed defect follow-up

Code review identified that clearing all scene/safety selections was silently reversed by both form normalization and API request normalization. The new regression failed against the previous implementation: saving an empty scene selection restored the default park/greenway selection.

Removed only the array-length guards in normalizeForm and normalizeArray. The regression now covers cancelling all selected values, saveForm, reloading the stored form, and buildSearchRecommendationRequest. A companion regression confirms missing/non-array values still use defaults. The full client suite passes 19 tests after the fix.
