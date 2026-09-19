# AGENTS.md

Instructions for any AI tool working in this repo — Claude, Cursor, Copilot, Antigravity, or anything else. Read this before making changes, not after.

## What this repo is

A monorepo with two independent apps:

```
frontend/   React 19 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
backend/    Node + Express 5 + TypeScript + Prisma + PostgreSQL
docs/       Team-facing docs (setup, architecture)
```

They are **not** an npm workspace — each has its own `package.json`, its own `node_modules`, its own lockfile. Don't add root-level dependencies for app code, and don't try to hoist/share `node_modules` between them. The root `package.json` exists only to run husky.

## Scope rules — read this before touching anything

- **One task per change.** If asked to do several unrelated things, do them as separate commits/PRs, not one sprawling diff. A PR that touches auth *and* an unrelated UI tweak is two PRs.
- **Stay inside the file(s) you were asked to touch.** Don't "helpfully" refactor a neighboring file, rename things, or fix unrelated lint warnings unless asked. If you notice something else that looks wrong, say so — don't silently fix it in the same diff.
- **Don't invent scope that was explicitly deferred.** The repo layer pattern (a data-access abstraction between services and Prisma) is a known, deliberately open decision — see `backend/src/services/auth.service.ts` for the comment explaining why Prisma calls live directly in the service for now. Don't introduce a repo layer unprompted, and don't introduce a second, different pattern alongside it.
- **The `User`/`RefreshToken` Prisma models are placeholders**, added only so the cookie-based login/refresh flow has something to attach to. Don't treat their shape as final. If a task needs new user fields, flag it rather than guessing at what the team wants.

## Architecture — follow this layering in the backend

```
routes/       defines endpoints + wires up middleware, no logic
controllers/  reads the request, calls a service, shapes the HTTP response
services/     business logic (currently talks to Prisma directly — see above)
middlewares/  auth, validation, rate limiting, error handling
schemas/      Zod request-validation schemas
utils/        stateless helpers (jwt, cookies, hashing, API response shapes)
```

A controller should never contain a raw Prisma/DB call. A route should never contain logic beyond wiring middleware + calling a controller. If a change doesn't fit this shape, say so instead of forcing it in somewhere.

## Things that will break if you don't know about them

- **Express 5, not 4.** `req.query` is a **getter-only** property — assigning to it throws at runtime. See `backend/src/middlewares/validate.middleware.ts` for the existing workaround (`req.validatedQuery` instead of overwriting `req.query`). Follow that pattern for any new validated-query use, don't reintroduce `req.query = ...`.
- **Auth is cookie-based, not header-based.** The access and refresh tokens live in httpOnly cookies (`accessToken`, `refreshToken`), set by `backend/src/utils/cookies.ts` and read in `backend/src/middlewares/auth.middleware.ts`. There is **no** `Authorization: Bearer` header flow — don't add one without asking; it would be a second, inconsistent auth path.
- **CORS requires an exact origin.** `credentials: true` CORS cannot pair with `origin: '*'` — the browser rejects it and cookies silently fail to send. The backend reads `CLIENT_URL` from env for this; don't hardcode a wildcard or a different origin.
- **Refresh tokens are single-use (rotation).** Each call to `/auth/refresh` revokes the old refresh token and issues a new pair. Don't "simplify" this to reusable refresh tokens — that removes the main security benefit of storing them server-side at all.
- **Frontend never stores a token.** `useAuthStore` only holds a `user` object for UI convenience — the cookie is the actual source of truth. Don't add a `token` field back to the store or read one out of a cookie in JS (that would defeat the point of `httpOnly`).

## Secrets — hard rule, no exceptions

- Never put a real secret, API key, token, or connection string in code, in a commit, or in a prompt/chat with any AI tool — including this one. Use the placeholder values already in `.env.example`.
- Never read `.env` and paste its contents into a chat, a comment, or a commit message, even to "explain the config."
- If you're generating example `.env` values, use obviously-fake placeholders (`your_access_token_secret_here`), never a real-looking secret.

## Before you finish a task

- Every new file/function needs a test in the same change — not a follow-up.
- Run the relevant folder's lint, build, and test scripts yourself before handing back a diff (`npm run lint`, `npm run build`, `npm test`, from inside `frontend/` or `backend/`). Don't hand back code you haven't verified compiles and passes.
- If your change touches the Prisma schema, remind whoever's applying it that a migration is needed (`npm run prisma:migrate`) — don't run migrations against a real/shared database yourself.

## Git conventions (see `docs/SETUP.md` for the full team guide)

- Branch names: `type/short-description` (`feat/ticket-assignment`, `fix/mentor-chat-scroll`)
- Commit messages: [Conventional Commits](https://www.conventionalcommits.org/) — `feat: add ticket assignment service`
- Keep diffs scoped to one task, per the rule above — this also makes commit messages easier to write honestly.

## When you're not sure

Say what you're unsure about and propose an approach — don't silently pick one and hope. This repo has a few genuinely open decisions (repo layer, real user model, what "voxide" and the payment provider actually are) that no AI tool should resolve unilaterally.
