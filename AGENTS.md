# Repository Guidelines

## Project Structure & Module Organization

This repository contains the technical stack for the Giocatori Stanchi community. GSPlay is one component, not the repository boundary. New community technical components belong here by default unless a concrete operational or ownership reason calls for a separate repository; do not pre-build directories or abstractions for hypothetical services.

The backend is split by runtime ownership. `src/api/` owns Express, HTTP, sessions, uploads, previews, routes, and request/response concerns. `src/worker/` owns polling, handlers, throttling, and worker orchestration. `src/core/` owns concrete runtime-neutral models, database access, providers, domain services, queue operations, configuration, migrations, and community time. API and worker may depend on core; core must never depend on either runtime. A capability may belong in core even with one consumer when it is genuinely runtime-neutral, but introduce shared abstractions only for an actual need. See `docs/Architecture.md` before making structural changes.

Backend tests mirror ownership under `tests/api/`, `tests/core/`, and `tests/worker/`. Keep operational CLI entry points in `scripts/` and host definitions in `deploy/`; reuse established configuration, logging, database, deployment, testing, and systemd patterns. Large structural changes must be deliberate rather than incidental.

The React/Vite GSPlay client is in `gsplay-frontend/`. Place screens in `src/pages/`, reusable UI in `src/components/`, API access in `src/services/`, and Playwright scenarios in `e2e/`. Project documentation belongs in `docs/`.

## Build, Test, and Development Commands

- `npm ci`: install locked backend dependencies.
- `npm run dev`: start the API, worker, and Vite client with reload support.
- `npm test`: run Jest backend tests serially against MongoMemoryServer.
- `npm run test:coverage`: generate text, LCOV, and HTML coverage in `tests/coverage/`.
- `npm run bootstrap`: create or verify MongoDB indexes.
- `npm --prefix gsplay-frontend run lint`: lint frontend JavaScript and JSX.
- `npm --prefix gsplay-frontend run build`: produce the frontend production bundle.
- `npm --prefix gsplay-frontend run test:e2e`: run Playwright release smoke tests.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons in CommonJS backend files, and the established semicolon-free ESM frontend style. Use `camelCase` for functions and variables, `PascalCase` for components and models, and suffixes such as `Routes`, `Service`, or `Client`. Keep route handlers thin. Run frontend ESLint before submitting.

## User-Facing Copy

GSPlay's playful Roman voice is a product trademark. Member-facing pages should use concise,
good-natured Roman-flavoured Italian for headings, introductions, empty states, confirmations, and
recoverable errors. Keep actions understandable and status labels unambiguous; the joke must never
hide what a control does or what happened. Match established pages such as Home, Catalogue, Game
Detail, and Casual Friday instead of dropping neutral product boilerplate into a public screen.

Administration and helper tools should stay dry, direct, and operational. Backend/API errors,
security messages, documentation, accessibility labels, and destructive confirmations should
prioritize precision over personality. Add or update Playwright assertions when distinctive public
copy is part of the interaction.

## Testing Guidelines

Name backend tests `*.test.js` and Playwright tests `*.spec.js`. Isolate provider calls with fakes or mocks. Tests must not depend on `.env`, local MongoDB data, or live credentials. Run the full backend suite and relevant frontend checks before opening a pull request. No coverage threshold is configured; cover new behavior and regressions.

## Commit & Pull Request Guidelines

Recent history generally uses concise, imperative Conventional Commit subjects, for example `fix(ui): align form layout` or `feat(catalogue): add filtering`; occasional plain imperative subjects exist. Prefer the scoped format. Pull requests should explain the user-visible change, identify affected API or worker behavior, link related issues, and list verification commands. Include screenshots for UI changes and call out schema, environment, or deployment implications explicitly.

## Security & Configuration

Copy `.env.example` locally and never commit secrets. Keep access and refresh JWT secrets independent, and do not expose provider credentials through frontend environment variables. Review `docs/Operations-Runbook.md` before production or schema-related work.
