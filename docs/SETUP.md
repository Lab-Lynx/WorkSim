# Setup Guide

Read this before your first commit. It's the fast path from "just cloned the repo" to "husky and CI actually work."

## 1. Prerequisites

- **Node 20** — an `.nvmrc` is in the root and in each of `frontend/` and `backend/`. Run `nvm use` in whichever folder you're working in.
- **Docker** (for the backend's local Postgres) — [Docker Desktop](https://www.docker.com/products/docker-desktop/) or the CLI, whichever you're used to.
- **Git**

## 2. First-time setup

```bash
git clone <this-repo-url>
cd <repo-folder>

# Installs root deps (husky) AND both apps' deps in one go
npm run install:all
```

This also runs husky's `prepare` script, which wires up `.husky/pre-commit` and `.husky/pre-push` for the whole repo — you don't need to run anything husky-specific yourself.

## 3. Backend setup

```bash
cd backend
cp .env.example .env
# fill in ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET with your own random
# strings for local dev — see the comment in .env.example for a one-liner
# that generates one

docker compose up -d        # starts local Postgres
npm run prisma:generate
npm run prisma:migrate      # creates the User/RefreshToken tables
npm run dev
```

Full details: [`backend/README.md`](../backend/README.md).

## 4. Frontend setup

```bash
cd frontend
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Full details: [`frontend/README.md`](../frontend/README.md).

## 5. What husky actually does here

Hooks live in the **root** `.husky/` folder now, not inside each app. When you commit or push, the root hook figures out whether your change touched `frontend/`, `backend/`, or both, and only runs that folder's checks — so a backend-only change doesn't wait on frontend tests, and vice versa.

- `pre-commit` → runs the changed folder's own lint-staged (eslint + prettier on staged files)
- `pre-push` → runs the changed folder's own test suite, scoped to files that changed vs `origin/main`

You don't configure anything for this to work — it's automatic once `npm run install:all` has run once.

## 6. GitHub setup (do this once, in repo settings — not a file)

- **Branch protection on `main`**: Settings → Branches → require a pull request before merging, require at least 1 approval, require the CI status checks (`Backend CI` / `Frontend CI`) to pass before merging, and disallow direct pushes to `main`.
- Both `backend-ci.yml` and `frontend-ci.yml` are path-filtered — they only run when their own folder (or their own workflow file) changes, so you won't see a "Backend CI" check on a docs-only PR.

## 7. Branch and commit naming

See [`AGENTS.md`](../AGENTS.md) for the exact conventions — they apply whether a human or an AI tool is writing the commit.

## 8. A known gap worth knowing about early

The Prisma schema only has a **minimal placeholder `User` model** (id, email, passwordHash, role) plus a `RefreshToken` model — added only so the login/refresh cookie flow has something to attach to. The team hasn't decided the real user shape or the repo-layer pattern yet. If you're building something that needs `User`, check with the team lead before extending the schema so two people don't design it differently in parallel.

## 9. Helpful references

**Backend**
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) — a few behaviors changed from Express 4 (notably: `req.query` is now read-only — see the comment in `backend/src/middlewares/validate.middleware.ts` for the workaround already in place)
- [Prisma docs](https://www.prisma.io/docs)
- [Prisma + Decimal fields](https://www.prisma.io/docs/orm/prisma-client/type-safety/operating-against-partial-structures-of-model-types) — if you add a `Decimal` field later (money, precise measurements), note that Prisma returns a `Decimal.js` object in JS, not a plain `number`. `JSON.stringify` and direct arithmetic on it will surprise you — convert explicitly with `.toNumber()` (fine for display) or keep it as a `Decimal` for anything that needs to stay precise (money math). We don't have any `Decimal` fields yet, but this will come up the moment someone adds a price or amount field.
- [jsonwebtoken docs](https://github.com/auth0/node-jsonwebtoken)
- [MDN: Set-Cookie — SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value) — worth reading once if you're touching anything in `backend/src/utils/cookies.ts`, since we're on `SameSite=None` in production (frontend and backend are on different domains)

**Frontend**
- [TanStack Query docs](https://tanstack.com/query/latest) — for anything that comes from the backend; don't reach for `useEffect` + `fetch`
- [Zustand docs](https://zustand.docs.pmnd.rs/) — for UI-only state (auth's `user` field, theme, modals — not server data)
- [React Router v7 docs](https://reactrouter.com/)
- [shadcn/ui](https://ui.shadcn.com/docs/components) — component source is copied into the project (`npx shadcn@latest add <component>`), not installed as a package, so you can freely edit what gets added

**Both**
- [Conventional Commits](https://www.conventionalcommits.org/) — the format our commit messages follow
- [Vitest docs](https://vitest.dev/)
