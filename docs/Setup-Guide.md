# GSPlay v2 setup guide

The active branch contains only the v2 runtime. The former implementation is preserved at the `v1-final` tag and `legacy-v1` branch for reference; do not use its instructions for a current deployment.

## Local environment

Requirements: Node.js, npm, MongoDB, and Git.

```bash
git clone https://github.com/Talref/gsplay.git
cd gsplay
cp .env.example .env
```

Set two **different** high-entropy values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Configure provider credentials only if you need Steam sync or IGDB enrichment. Never commit `.env`.

Install and run the services:

```bash
npm ci
npm run bootstrap
npm run dev

# second terminal
npm run worker

# third terminal
cd gsplay-frontend
npm ci
npm run dev
```

The API listens on `127.0.0.1:3000` by default and the Vite frontend on `127.0.0.1:5173`.

## Tests

```bash
npm test

cd gsplay-frontend
npm run lint
npm run build
npm run test:e2e
```

Backend tests and the E2E suite use isolated in-memory MongoDB instances. They do not require a development database or provider credentials.

## Production

The complete Arch Linux/Caddy/systemd deployment, MongoDB backup, v1 migration, cutover, health-check, and rollback procedure is in [V2-Cutover-Runbook.md](./V2-Cutover-Runbook.md).

In short, production uses a root-owned `/etc/gsplay/v2.env`, an API and worker bound to loopback, Caddy as the TLS frontend, and the staged `scripts/deploy-v2.sh` deployment script.