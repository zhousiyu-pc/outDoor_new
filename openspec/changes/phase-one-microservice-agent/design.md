## Context

The phase-one product requires Java business services, Python Agent services, MySQL target persistence, Mini Program frontend, and Docker deployment preparation for WeChat Cloud Run. Existing target project has a Mini Program baseline but no backend services.

## Goals / Non-Goals

**Goals:**
- Implement a minimal Java business service.
- Implement a minimal Python Agent service.
- Preserve candidate-vs-formal-asset separation.
- Provide MySQL schema and Dockerfiles.
- Provide local verification scripts and human acceptance entry.

**Non-Goals:**
- No dependency installation.
- No real external platform crawling.
- No real MySQL mutation.
- No WeChat Cloud deployment.
- No Git commit / push.

## Decisions

1. Use dependency-free Java and Python services for this slice to avoid install and network-pull gates.
2. Keep Java as the business owner and Python as Agent/source orchestration owner.
3. Store local adoption data in a generated runtime file for smoke testing; MySQL schema is prepared but not applied.
4. Candidate routes remain non-formal until explicit user adoption.

## Risks / Trade-offs

- [No framework] → easier local verification but not final production stack.
- [Mock Skill] → validates contract, not actual platform data coverage.
- [No real DB] → schema requires later DB migration and QA.

## Migration Plan

After human acceptance, replace dependency-free skeleton with Spring Boot + MySQL Repository and FastAPI/agent runtime only after explicit dependency/database/deployment authorization.
