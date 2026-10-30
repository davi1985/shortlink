# ShortLink

Full-stack URL shortener, anonymous in the MVP, with custom aliases and a default 24-hour expiration.

## Status

**Phase 0 — Monorepo foundation and tooling** is complete. Backend, frontend, contracts, and business tests will be implemented in the following phases, as described in `docs/IMPLEMENTATION_PLAN.md`.

## Structure

```text
shortlink/
├── apps/
│   ├── api/                 # NestJS + Fastify backend (skeleton)
│   └── web/                 # React + Vite frontend (skeleton)
├── packages/
│   └── contracts/           # shared contracts (skeleton)
├── docs/
│   ├── PRD.md
│   └── IMPLEMENTATION_PLAN.md
├── .env.example
├── firebase.json
├── firestore.rules
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Prerequisites

- Node.js 24 or newer.
- pnpm 10.
- Git.

## Installation

```bash
pnpm install
```

Husky's `prepare` script configures the `pre-commit` hook automatically.

## Environment variables

Copy `.env.example` to `.env` and adjust the local values:

```bash
cp .env.example .env
```

Never commit `.env`, Firebase credentials, or service account files. `.env.example` contains only fictitious values.

## Available commands

| Command                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `pnpm lint`             | Runs ESLint across the workspace.         |
| `pnpm lint:fix`         | Fixes lint issues automatically.          |
| `pnpm format`           | Formats files with Prettier.              |
| `pnpm format:check`     | Checks formatting without changing files. |
| `pnpm typecheck`        | Type-checks every package.                |
| `pnpm build`            | Builds packages in workspace order.       |
| `pnpm test`             | Runs the available tests in each package. |
| `pnpm test:integration` | Runs the available integration tests.     |
| `pnpm test:e2e`         | Runs the available end-to-end tests.      |

Commands to run the backend, frontend, and emulator will be added in their corresponding phases.

## Pre-commit hook

The hook runs `pnpm lint && pnpm typecheck` and blocks the commit when either check fails. CI remains the final authority.

## Firestore

- `firebase.json` configures the Firestore Emulator on port `8080` and its UI on port `4000`.
- `firestore.rules` denies direct client reads and writes. Access will be exclusive to the backend through the Firebase Admin SDK.

## Documentation

- `AGENTS.md`: permanent working instructions.
- `docs/PRD.md`: functional requirements.
- `docs/IMPLEMENTATION_PLAN.md`: phases, decisions, and progress.
