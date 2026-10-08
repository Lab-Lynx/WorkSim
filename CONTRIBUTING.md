# Contributing to Work Simulator

Thanks for helping build Work Simulator. This guide is the short version of how we work. The detailed rules live in [`AGENTS.md`](AGENTS.md) and [`docs/SETUP.md`](docs/SETUP.md); they apply equally to people and to AI tools.

## Repository layout

```
frontend/   React 19 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
backend/    Node + Express 5 + TypeScript + Prisma + PostgreSQL
docs/       Setup, architecture, specs and test plans
```

`frontend/` and `backend/` are independent apps. Each has its own `package.json`, `node_modules` and lockfile. Do not hoist dependencies to the root; the root `package.json` exists only for husky.

## Getting started

Follow [`docs/SETUP.md`](docs/SETUP.md) for prerequisites (Node 20, Docker, Git), installing dependencies, and starting the local database. In short:

```bash
npm run install:all          # root (husky) + frontend + backend
cd backend && cp .env.example .env && docker compose up -d
npm run prisma:generate && npm run prisma:migrate && npm run dev
```

## Workflow

1. **Pick one task.** One task per branch and per pull request. If you spot something unrelated, mention it in the PR or open an issue instead of folding it into the same diff.
2. **Branch from the latest `main`** using `type/short-description`:
   `feat/ticket-assignment`, `fix/mentor-chat-scroll`, `docs/contributing-guide`.
3. **Commit with [Conventional Commits](https://www.conventionalcommits.org/):**
   `feat: add ticket assignment service`, `fix: handle empty mentor reply`, `chore: bump vitest`.
4. **Open a pull request** using the template. Keep it small enough to review in one sitting.
5. **Get a review** from the owners requested automatically via [`.github/CODEOWNERS`](.github/CODEOWNERS), and make sure CI is green.
6. **Merge** once approved. Do not push directly to `main`.

## Code ownership

| Area | Owner |
| --- | --- |
| Lead, architecture, AI | @Messibre |
| Backend and database core, main UI/UX | @kirub07sj |
| Backend external APIs (GitHub, payments, email) | @TsiOnshime |
| Frontend hooks, data layer, voxide integration | @RuthInTech |
| Frontend components and pages | @fenet-as |

If your change spans several areas, expect more than one reviewer. Ask in the PR if you are unsure who should look at it.

## Before you open a PR

Run these from inside the folder you changed (`frontend/` or `backend/`):

```bash
npm run lint
npm run build
npm test
```

- Every new file or function needs a test **in the same change**, not a follow-up.
- Do not hand in code you have not verified compiles and passes.
- Backend integration tests need the local Postgres from `docker compose up -d`.
- If you changed `backend/prisma/schema.prisma`, include the migration (`npm run prisma:migrate`) and say so in the PR. Never run migrations against a shared or production database from your machine.

## Architecture rules

Backend layering (details in `AGENTS.md`):

```
routes/       endpoints and middleware wiring, no logic
controllers/  read the request, call a service, shape the response
services/     business logic
middlewares/  auth, validation, rate limiting, error handling
schemas/      Zod request-validation schemas
utils/        stateless helpers
```

- A controller never contains a raw Prisma call. A route never contains logic beyond wiring.
- Express 5: `req.query` is read-only. Use `req.validatedQuery` as in `validate.middleware.ts`.
- Auth is cookie-based (httpOnly `accessToken` and `refreshToken`). Do not add an `Authorization: Bearer` flow or store tokens in the frontend.
- Refresh tokens are single-use and rotate on every refresh. Keep it that way.
- CORS uses the exact `CLIENT_URL` origin. Never use a wildcard with credentials.
- Do not introduce a repo layer or a second data-access pattern without agreeing it with the lead.

Frontend:

- Server data goes through TanStack Query; Zustand is for UI-only state.
- Do not fetch inside `useEffect`.
- Use the existing shadcn/ui components and design tokens before writing new ones.

## Secrets and security

- Never commit a real secret, token or connection string, and never paste one into a chat, prompt, comment or commit message. Use the placeholders in `.env.example`.
- Do not paste the contents of `.env` anywhere.
- Report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md), not in public issues.

## Using AI tools

AI assistants are welcome, but you are responsible for what you commit. Read [`docs/team-ai-guidelines.md`](docs/team-ai-guidelines.md) and [`AGENTS.md`](AGENTS.md) first, review every generated line, and keep the diff scoped to one task.

## Reporting bugs and proposing changes

Open an issue with clear reproduction steps, expected and actual behaviour, and the area affected. For larger changes or any of the open decisions listed in `AGENTS.md` (repo layer, real user model, payment provider), discuss with the lead before writing code.

## License

By contributing you agree that your contributions are licensed under the project's [MIT License](LICENSE).
