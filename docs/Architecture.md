# Architecture

This repository is the technical stack for the Giocatori Stanchi community. GSPlay is its current web product, but the repository boundary also includes the API, worker, shared data and domain capabilities, integrations, deployment definitions, and operational tools. Keeping directly related community technology together allows components to share contracts and capabilities without forcing them into one process.

## Runtime boundaries

```text
API runtime ---------\
Worker runtime -------+-- runtime-neutral core
GSbot runtime --------/

Operational scripts ----> core
E2E harness ------------> API + core
```

- `src/api/` owns Express startup, routes, middleware, sessions, HTTP errors and validation, uploads, and response-oriented services.
- `src/worker/` owns polling, job execution, handlers, throttling, and worker-only orchestration.
- `src/gsbot/` owns Discord connectivity, command registration, interactions, and GSbot lifecycle.
- `src/core/` owns runtime-neutral models, database access, provider clients, domain/application services, shared queue operations, configuration, migrations, and the community clock.
- `gsplay-frontend/` is the existing GSPlay React/Vite frontend and remains independently runnable.
- `scripts/` contains operational CLI entry points; reusable logic they invoke may live in core.
- `deploy/` contains host and runtime deployment definitions.

API, worker, and GSbot may import core. Core must not import runtime-specific code. `npm run lint:backend` enforces that direction with a lightweight local-import check. Runtime-neutral capabilities belong in core based on what they do, not how many callers they currently have. Shared abstractions should still exist only when there is a concrete abstraction need.

Tests mirror ownership in `tests/api/`, `tests/core/`, `tests/worker/`, and `tests/gsbot/`. Each runtime's development command watches its own sources and core.

## Monorepo intent

Technical components directly supporting the community belong here by default so they can reuse established configuration, persistence, deployment, testing, and operational patterns. This does not require one runtime, one deployment unit, or speculative scaffolding. A separate repository should follow a concrete isolation, lifecycle, security, or ownership need.

## Compatibility names

The former implementation-wide `src/v2` and `tests/v2` namespaces were removed because no active v1 source tree remains. Existing `v2` names at external and operational boundaries remain deliberately unchanged: public `/api/v2` routes, `_v2` MongoDB collections, Mongoose model/ref names such as `UserV2`, `/etc/gsplay/v2.env`, and `gsplay-v2-*.service` systemd units. Changing those names would require client, data, or host migrations without improving the internal architecture.
