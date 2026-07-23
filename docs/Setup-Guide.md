# GSPlay setup guide

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

For initial host preparation and routine maintenance, use [Operations Runbook](./Operations-Runbook.md). Production uses a root-owned `/etc/gsplay/v2.env`, loopback-bound API and worker systemd services, Caddy TLS termination, and `scripts/deploy.sh` for updates.