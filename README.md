# Work Simulator

> "Your first job before you get your first job." A monorepo containing the platform's frontend, backend, and shared project docs.

---

## 📦 Monorepo structure

```text
.
├── frontend/            React + Vite SPA — see frontend/README.md
├── backend/              Express + Prisma API — see backend/README.md
├── docs/                 Team-facing docs (setup guide, architecture notes)
├── .husky/               Git hooks (root-level, path-aware — see below)
├── .github/workflows/    CI pipelines (backend-ci.yml, frontend-ci.yml)
├── AGENTS.md              Rules for any AI tool working in this repo
└── package.json           Root — orchestrates husky + per-folder scripts only
```

`frontend/` and `backend/` are **independent apps**, each with its own `package.json`, lockfile, and `node_modules` — not an npm workspace. The root only exists to wire up git hooks and give you one place to run either app's scripts from.

---

## 🛠 Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand, React Router v7 |
| Backend | Node.js, Express 5, TypeScript, Prisma, PostgreSQL, Zod, JWT (access + refresh, httpOnly cookies) |
| Tooling | ESLint, Prettier, Husky + lint-staged, Vitest, GitHub Actions |

---

## 🚀 Quick start

```bash
git clone <this-repo-url>
cd work-simulator
npm run install:all
```

Then set up each app — full steps (env vars, database, running the dev servers) are in **[`docs/SETUP.md`](docs/SETUP.md)**. Short version:

```bash
# backend
cd backend && cp .env.example .env && docker compose up -d && npm run prisma:migrate && npm run dev

# frontend (separate terminal)
cd frontend && cp .env.example .env && npm run dev
```

---

## 📜 Root-level scripts

| Command | What it does |
|---|---|
| `npm run install:all` | Installs root, `frontend/`, and `backend/` dependencies in one go |
| `npm run dev:frontend` | Runs the frontend dev server |
| `npm run dev:backend` | Runs the backend dev server |
| `npm run lint:frontend` / `npm run lint:backend` | Lints one app |
| `npm run test:frontend` / `npm run test:backend` | Tests one app |

Each app also has its own full script set — see `frontend/README.md` and `backend/README.md`.

---

## 🪝 Git hooks (Husky)

Hooks live at the **root**, not inside each app, and are **path-aware**: they only run checks for the folder(s) you actually changed.

- **`pre-commit`** — runs `frontend/`'s or `backend/`'s own `lint-staged` (ESLint + Prettier), scoped to whichever folder has staged changes
- **`pre-push`** — runs `frontend/`'s or `backend/`'s own test suite, scoped to files changed vs `origin/main`

A commit that only touches `backend/` never waits on frontend checks, and vice versa. You don't configure anything for this — it's set up automatically by `npm run install:all` (via the root `prepare` script).

---

## ✅ CI

Two independent, path-filtered GitHub Actions workflows:

- **`.github/workflows/backend-ci.yml`** — runs only when `backend/**` changes: install → Prisma generate → lint → build → test
- **`.github/workflows/frontend-ci.yml`** — runs only when `frontend/**` changes: install → lint → build → test

`main` is protected: a pull request, at least one approval, and a green CI check are required before merging (configured in repo settings — see `docs/SETUP.md` for the exact steps).

---

## 🤖 Using AI tools in this repo

Before using Claude, Cursor, Copilot, Antigravity, or anything else to write code here, read **[`AGENTS.md`](AGENTS.md)**. It covers the things that will break silently if an AI tool doesn't know about them (Express 5's `req.query` behavior, the cookie-based auth flow, the deliberately-unresolved repo-layer decision) and the scope/secrets rules that apply to AI-written code the same as human-written code.

---

## 🌱 Environment variables

Each app has its own `.env.example` — copy it to `.env` and fill in real values locally. Never commit a real `.env`. See `docs/SETUP.md` for what each variable does and where to get/generate it.

---

## 🤝 Contributing

1. Branch off `main`: `type/short-description` (e.g. `feat/ticket-assignment`)
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`)
3. Keep PRs scoped to one task
4. Open a PR against `main` — CI must be green and you need at least one approval before merging

Full team + AI usage guidelines: `docs/SETUP.md`.

---

## 📄 License

MIT — see each app's own README for specifics if that changes per-app.
