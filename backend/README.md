# 🚀 Work Simulator — Backend API

> **A robust, secure, and production-grade REST API powering the Work Simulator engineering platform.**  
> Built with Node.js, Express 5, TypeScript, Prisma ORM, and PostgreSQL.

---

[![Express 5](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

---

## 📖 Overview

The Work Simulator Backend API manages all platform operations, simulating an enterprise engineering workflow for junior developers:
- **Cookie-Based Authentication & Session Management:** Zero-token client model using rotating httpOnly cookies.
- **Free Trial & Subscription Lifecycle:** Every account gets 3 free tickets with no subscription needed to connect GitHub or use the mentor; after that, Chapa hosted checkout (with cryptographic HMAC webhook verification) unlocks unlimited tickets.
- **GitHub Integration Service:** OAuth handshake, AES-256-GCM encrypted token persistence, starter repository provisioning, and GitHub Actions CI webhooks.
- **Controlled Ticket Generation:** Structural templating combined with Google Gemini for reproducible, testable software engineering tasks.
- **AI Mentorship Engine:** State-machine driven, 4-stage progressive hints preventing code copy-pasting.
- **Dual-Pass Code Evaluation Engine:** Automated git diff and CI test verification with rubric-based scoring.
- **Work-Sample Portfolio Service:** Aggregating tickets, code diffs, CI test logs, and rubric breakdowns.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime & Framework** | Node.js (`>=20.x`), Express 5 | High-performance asynchronous HTTP server with modern routing |
| **Language** | TypeScript (Strict Mode) | End-to-end type safety, typed Express extensions, and strict compilation |
| **Database & ORM** | PostgreSQL, Prisma ORM, `@prisma/adapter-pg` | Type-safe queries, migration management, and pooled connection handling |
| **Security & Cryptography**| bcrypt, jsonwebtoken, crypto (AES-256-GCM, SHA-256), helmet | Password hashing, token rotation, OAuth token encryption, security headers |
| **Validation** | Zod | Request body, query string, and parameter schema validation |
| **Rate Limiting** | express-rate-limit | Tiered IP and cost-based throttling (auth, AI endpoints, webhooks) |
| **Logging & Correlation** | Pino, pino-http, node:crypto UUID | Structured JSON logging bound to `X-Request-Id` correlation tokens |
| **AI Providers** | Google Gemini SDK, Groq SDK | Progressive hints, ticket generation, and rubric evaluation |
| **Testing** | Vitest, Supertest | Unit testing, integration testing, and mock third-party services |

---

## 🏛 Clean Layered Architecture

The backend strictly enforces a layered architecture to maintain clear boundaries and separation of concerns:

```mermaid
graph TD
    Client[HTTP Client / Frontend] --> Middlewares[Middlewares Pipeline\n• Request ID & Pino\n• Helmet & Strict CORS\n• Raw Webhook / JSON Parser\n• CSRF Origin Validator\n• Rate Limiters]
    Middlewares --> Routes[Routes Layer\nEndpoint definitions & Guard binding]
    Routes --> Guards[Access Guards\nauthMiddleware -> requireGitHub\n-> requireStarterRepo]
    Guards --> Validators[Zod Validation\nbody, params, req.validatedQuery]
    Validators --> Controllers[Controllers Layer\nHTTP parsing & ApiResponse shaping]
    Controllers --> Services[Services Layer\nBusiness logic & External APIs]
    Services --> DB[(Prisma ORM & PostgreSQL)]
    Services --> AI[External APIs: Gemini / GitHub / Chapa]
```

### Layer Responsibilities
- **`routes/`:** Registers API endpoints, wires middleware pipelines, and delegates directly to controllers. Routes contain zero business or database logic.
- **`controllers/`:** Unpacks request inputs, invokes service functions, and formats HTTP responses using standard envelopes (`ApiResponse` / `ApiError`).
- **`services/`:** Houses all business rules, orchestration of third-party integrations (Gemini, GitHub, Chapa), and Prisma database queries.
- **`middlewares/`:** Reusable filters for authentication, prerequisite access guards, CSRF origin verification, rate limiting, and global error handling.
- **`schemas/`:** Declarative Zod schemas defining and validating request contracts.
- **`serializers/`:** Transforms Prisma models into public Data Transfer Objects (DTOs), guaranteeing sensitive fields like `passwordHash` are never leaked.
- **`utils/`:** Stateless utilities for cookie configuration, JWT signing/verifying, token hashing, and cryptographic encryption.

> **Express 5 Gotcha:** In Express 5, `req.query` is a getter-only property. Mutating `req.query = ...` throws a runtime `TypeError`. The application defines `req.validatedQuery` in `src/middlewares/validate.middleware.ts` to store validated query parameters safely.

---

## 🛡️ Security Architecture & Controls

```mermaid
flowchart TD
    subgraph Ingress [Request Ingress & Boundary Controls]
        Req[Incoming Request] --> CORS[CORS: Exact CLIENT_URL & Credentials]
        CORS --> CSRF{CSRF Guard:\nUnsafe Method?}
        CSRF -->|Yes| OriginCheck[Validate Origin/Referer == CLIENT_URL]
        CSRF -->|No| RateLimiter[Tiered Rate Limiters]
        OriginCheck --> RateLimiter
    end

    subgraph AuthPipeline [Authentication & Authorization Chain]
        RateLimiter --> AuthMw[authMiddleware:\nVerify httpOnly Access Cookie]
        AuthMw --> GitHubGuard[requireGitHubConnection:\nVerify Linked Account]
        GitHubGuard --> RepoGuard[requireStarterRepo:\nVerify Cloned Repository]
    end

    subgraph CoreExecution [Protected Business Logic]
        RepoGuard --> Service[Service Execution\n• AES-256-GCM Token Decryption\n• Atomic SQL Transactions\n• AI Budget Guards\n• Free-trial / subscription ticket gate]
    end
```

### Free trial and the subscription gate

Subscription is **not** an access guard on the route chain. Every authenticated user can connect GitHub, create a starter repository, chat with the mentor and submit pull requests. The only place the subscription is enforced is ticket assignment (`POST /tickets`), inside `ticket.service.ts`, via `assertCanAssignTicket` in `subscription.service.ts`:

1. If the user has a subscription whose `currentPeriodEnd` is in the future, they are allowed (unlimited tickets).
2. Otherwise they get `FREE_TICKET_LIMIT` tickets (`3`, defined in `src/constants/index.ts`). Usage is `COUNT(Ticket WHERE userId)`, so **abandoned tickets count too** and cannot be used to farm free tickets.
3. When the free tickets are used up, the API responds `402 Payment Required`: `You have used your 3 free tickets. An active subscription is required to continue`.

`GET /subscriptions/me` returns a `freeTickets` object (`limit`, `used`, `remaining`) that the frontend uses for the dashboard counter. A `requirePaidAccess` middleware exists in `access.middleware.ts` but is intentionally not attached to any route; do not add it to the GitHub, mentor or submission routes, because that would put the paywall in front of the free trial.

### 1. Dual Cookie Authentication & Token Rotation
- **Zero-Token Response Policy:** Tokens are never returned in JSON bodies or accessible to JavaScript.
- **Path-Restricted Cookies:**
  - `accessToken`: Short-lived (15 min), scoped to `/`.
  - `refreshToken`: Long-lived (7 days), scoped strictly to `/api/v1/auth`.
- **Hashed Storage & Single-Use Rotation:**
  - Refresh tokens are stored in the database exclusively as SHA-256 hashes (`RefreshToken.tokenHash`).
  - Every call to `/api/v1/auth/refresh` revokes the incoming token (`revokedAt = now()`) and issues a brand-new token pair in a single database transaction.
  - Presenting a previously revoked token triggers automatic session invalidation across all user devices.

### 2. Application-Level CSRF Defense
- While `httpOnly` prevents XSS token theft, it remains vulnerable to cross-site request forgery without explicit origin verification.
- `csrfMiddleware` intercepts all state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) carrying authentication cookies, enforcing that `Origin` or `Referer` matches `env.CLIENT_URL` exactly.

### 3. At-Rest OAuth Token Encryption (AES-256-GCM)
- User GitHub access tokens stored in `GitHubConnection` are encrypted at rest using **AES-256-GCM** with a random 12-byte initialization vector (IV) and authentication tag:
  `v1.<base64url-iv>.<base64url-authTag>.<base64url-ciphertext>`
- Decryption validates the authenticated tag to prevent ciphertext tampering.

### 4. Concurrency & Race-Condition Defenses
- Single-use operations (email verification and password resets) prevent double-claim race conditions by executing atomic SQL updates:
  ```ts
  const claimed = await tx.emailVerificationToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new ApiError(HTTP_STATUS.GONE, 'Token has already been used');
  }
  ```

### 5. Multi-Tier Rate Limiting
Configured in `src/middlewares/rateLimiter.middleware.ts` to defend both infrastructure and third-party API spend:
- `defaultLimiter`: Protects generic endpoints against volumetric DoS.
- `authLimiter`: Limits credential stuffing on `/auth/login` and `/auth/refresh`.
- `registrationLimiter`: Prevents automated account creation spam.
- `costLimiter`: Throttles ticket generation, submission reviews, and AI mentor interactions, protecting Google Gemini and Groq API budgets.

### 6. Cryptographic Webhook Security & Idempotency
- **Raw Body Stream Preservation:** Webhook routes (`/api/v1/webhooks/chapa` and `/api/v1/webhooks/github`) capture raw request bytes ahead of `express.json()` to perform exact **HMAC-SHA256 signature verification**.
- **Atomic Idempotency Guard:** Every event claims a unique record in `WebhookEvent` with composite unique constraint `(provider, eventKey)`. Replayed webhooks trigger a unique key violation (`P2002`) and exit cleanly without double processing.

### 7. AI Budget Enforcement & Prompt Injection Defense
- Ticket structures (files, criteria, test checklist) are statically defined templates; AI only populates text scenarios within predefined JSON schemas.
- Mentor hints follow a server-side state machine (`getMentorHintStage`). Clients cannot bypass stages or demand direct answers.
- Input size checks (`assertAiBudget`) evaluate UTF-8 byte length on tickets, diffs, and transcripts against `env.AI_TICKET_MAX_INPUT_BYTES`, rejecting oversized payloads before LLM invocation.

---

## ⚡ Database & Query Performance Architecture

```mermaid
erDiagram
    User ||--o{ RefreshToken : "userId"
    User ||--o{ EmailVerificationToken : "userId"
    User ||--o{ PasswordResetToken : "userId"
    User ||--o| GitHubConnection : "userId (unique)"
    User ||--o| StarterRepo : "userId (unique)"
    User ||--o{ Subscription : "userId"
    User ||--o{ Payment : "userId"
    User ||--o{ Ticket : "userId"
    Subscription ||--o{ Payment : "subscriptionId"
    Ticket ||--o{ MentorMessage : "ticketId"
    Ticket ||--o{ Submission : "ticketId"
    Submission ||--o| Evaluation : "submissionId (unique)"
```

### 1. Database Indexing Strategy
- **Foreign-Key Indexing:** Every relational key (`userId`, `subscriptionId`, `ticketId`, `submissionId`) is explicitly indexed to avoid full table scans.
- **Partial Unique Indexes:**
  - `Ticket_userId_active_key`: Enforces that a user can only have one active ticket (`assigned`, `in_progress`, `submitted_v1`, `resubmitted`) at any time.
  - `Subscription_userId_live_key`: Guarantees only one live subscription (`active` or `past_due`) per user.
- **Composite Indexes:** `[userId, status]`, `[userId, createdAt]`, and `[ticketId, createdAt]` optimize high-frequency dashboard queries and chat transcripts.
- **Database CHECK Constraints:** Attempt ranges (`1` or `2`), score ranges (`0` to `100`), and rubric constraints are enforced directly within PostgreSQL.

### 2. Zero N+1 Queries
- Service queries avoid looped database queries. Relations are fetched in a single round-trip using Prisma's `include` and `select` clauses:
  ```ts
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      submissions: {
        orderBy: { attempt: 'asc' },
        include: { evaluation: true },
      },
    },
  });
  ```

### 3. Resilient Connection Pooling
- Configured in `src/config/db.ts` utilizing `pg.Pool` with `@prisma/adapter-pg`.
- Supports connection pooling for Supabase and managed PostgreSQL instances.
- Graceful shutdown handlers in `server.ts` cleanly drain database connections upon receiving `SIGINT` or `SIGTERM`.

### 4. Correlation IDs & High-Throughput Logging
- Every request receives an immutable correlation UUID (`req.id` and `X-Request-Id` response header).
- Structured logging powered by `pino` and `pino-http` attaches the request ID to all log lines, facilitating distributed tracing without performance penalties.

---

## 📁 Directory Structure

```text
backend/src/
├── config/              # Environment validation (Zod) and database pool
├── constants/           # HTTP status codes, error codes, and business limits
├── controllers/         # Request handling and response dispatching
│   ├── auth.controller.ts
│   ├── github.controller.ts
│   ├── mentor.controller.ts
│   ├── payment.controller.ts
│   ├── profile.controller.ts
│   ├── submission.controller.ts
│   ├── subscription.controller.ts
│   ├── ticket.controller.ts
│   ├── user.controller.ts
│   └── webhook.controller.ts
├── emails/              # Transactional email templates (verification, reset)
├── integrations/        # Third-party API clients
│   ├── chapa.ts         # Payment initialization & verification
│   ├── gemini.ts        # AI ticket generation & progressive mentorship
│   ├── github.ts        # OAuth, repo creation & PR checks
│   ├── groq.ts          # AI rubric evaluation engine
│   └── resend.ts        # Transactional email dispatch
├── lib/                 # Core domain logic
│   ├── crypto/          # AES-256-GCM token encryption
│   └── scoring/         # Rubric weighting and calculation engine
├── middlewares/         # Express middlewares
│   ├── access.middleware.ts        # requirePaidAccess, requireGitHub, requireStarterRepo
│   ├── auth.middleware.ts          # JWT cookie verification & req.user binding
│   ├── csrf.middleware.ts          # Cross-site origin & referer validation
│   ├── error.middleware.ts         # Global exception interceptor
│   ├── rateLimiter.middleware.ts   # Tiered rate limiters
│   └── validate.middleware.ts      # Zod request validation
├── routes/              # Express 5 endpoint routers
│   ├── index.ts         # Central router mounting all feature routes
│   └── *.routes.ts
├── schemas/             # Zod validation schemas
├── serializers/         # Safe DTO transformers (excluding passwordHash)
├── services/            # Core business and database services
│   ├── auth.service.ts
│   ├── evaluation.service.ts
│   ├── github.service.ts
│   ├── mentor.service.ts
│   ├── profile.service.ts
│   ├── submission.service.ts
│   ├── subscription.service.ts
│   └── ticket.service.ts
├── ticket-templates/    # Statically verified ticket structures
├── types/               # TypeScript domain models and Express extensions
├── utils/               # JWT helpers, cookies, token hashing, Pino logger
├── app.ts               # Express application assembly & security middleware
└── server.ts            # Server entrypoint and graceful shutdown lifecycle
```

---

## 🌐 API Route Surface

All routes are mounted under `/api/v1`:

| Module | Method | Endpoint | Access Required | Description |
|---|---|---|---|---|
| **Auth** | `POST` | `/auth/register` | Public | Register new user, set cookies, send verification email |
| | `POST` | `/auth/login` | Public | Authenticate user credentials, issue cookies |
| | `GET` | `/auth/guest` | Public | Report whether guest login is configured |
| | `POST` | `/auth/guest` | Public | Sign in to the pre-provisioned guest account for demos and judging |
| | `POST` | `/auth/refresh` | Public | Rotate refresh token cookie, issue new access cookie |
| | `POST` | `/auth/logout` | Authenticated | Revoke refresh token in DB, clear auth cookies |
| | `POST` | `/auth/logout-all`| Authenticated | Invalidate all active sessions for current user |
| | `GET` | `/auth/me` | Authenticated | Return public profile of currently authenticated user |
| | `POST` | `/auth/verify-email` | Public | Consume email verification token |
| | `POST` | `/auth/resend-verification` | Public | Resend the verification email (same response whether or not the account exists) |
| | `POST` | `/auth/forgot-password`| Public | Request password reset email |
| | `POST` | `/auth/reset-password` | Public | Consume reset token and set new password |
| | `POST` | `/auth/change-password` | Authenticated | Change password (requires the current password) |
| **Users** | `GET` / `PATCH` | `/users/me` | Authenticated | Read or update the signed-in user's profile and display name |
| **Billing** | `GET` | `/subscriptions/me` | Authenticated | Subscription status, renewal date and free-ticket usage (`freeTickets`) |
| | `POST` | `/subscriptions/checkout`| Authenticated | Initialize Chapa checkout URL (needed only after the 3 free tickets) |
| | `POST` | `/subscriptions/cancel` | Authenticated | Cancel subscription at end of billing period |
| | `GET` | `/payments` | Authenticated | List historical payment receipts |
| **GitHub** | `GET` | `/github/connect` | Authenticated | Generate GitHub OAuth authorize URL (free trial included) |
| | `GET` | `/github/callback`| Public (signed `state`) | OAuth redirect target: exchange code, encrypt and store access token |
| | `GET` | `/github/connection` | Authenticated | Check GitHub link status |
| | `DELETE` | `/github/connection` | Authenticated | Disconnect GitHub |
| | `POST` | `/github/repo` | Authenticated | Create starter repository from the chosen template |
| **Tickets** | `POST` | `/tickets` | Authenticated + GH + Repo | Assign new structured AI ticket. Enforces the free-trial / subscription gate (`402` after 3 free tickets) |
| | `GET` | `/tickets/current` | Authenticated | Get current active ticket details |
| | `GET` | `/tickets/:ticketId` | Authenticated | Get ticket details and submission history |
| | `POST` | `/tickets/:ticketId/start` | Authenticated | Transition ticket status to in_progress |
| | `POST` | `/tickets/:ticketId/abandon` | Authenticated + GH + Repo | Abandon active ticket (still counts toward the free limit) |
| **Mentor** | `POST` | `/tickets/:ticketId/mentor/messages` | Authenticated | Send message to AI mentor (progressive hint). Rate limited |
| | `GET` | `/tickets/:ticketId/mentor/messages` | Authenticated | Fetch full mentor chat transcript |
| **Submissions** | `GET` | `/submissions` | Authenticated | List the user's submissions |
| | `POST` | `/tickets/:ticketId/submissions` | Authenticated + GH + Repo | Submit PR attempt (triggers CI evaluation) |
| | `GET` | `/tickets/:ticketId/submissions/:attempt` | Authenticated | Get submission details, diff, and evaluation |
| | `POST` | `/tickets/:ticketId/submissions/:attempt/retry` | Authenticated | Retry failed evaluation pipeline |
| **Profile** | `GET` | `/profile` | Authenticated | Fetch completed ticket history, diffs, and rubric scores |
| **Webhooks** | `POST` | `/webhooks/chapa` | Public (HMAC Verified) | Process Chapa payment confirmations |
| | `POST` | `/webhooks/github`| Public (HMAC Verified) | Process GitHub Actions `workflow_run` CI results |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `>= 20.0.0`
- Docker & Docker Compose
- PostgreSQL 16+

### 1. Installation
From the backend directory:
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Generate cryptographic keys for JWT signing and token encryption:
```bash
# Generate high-entropy 48-byte hex secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Populate `.env` with:
- `DATABASE_URL`: PostgreSQL connection string.
- `ACCESS_TOKEN_SECRET` & `REFRESH_TOKEN_SECRET`: Distinct secrets for JWTs.
- `GITHUB_TOKEN_ENCRYPTION_KEY`: High-entropy encryption secret for OAuth tokens.
- `CLIENT_URL`: Exact URL of the frontend (e.g. `http://localhost:5173`).
- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` (the API's `/api/v1/github/callback`), `GITHUB_WEBHOOK_SECRET`.
- Payments (needed only for the paid tier, not the free trial): `CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`, `CHAPA_RETURN_URL`; optionally `CHAPA_PRICE` and `CHAPA_CURRENCY` (defaults `29` ETB).
- AI keys: `GEMINI_API_KEY`, `GROQ_API_KEY`.
- `TEST_DATABASE_URL`: a separate, local test database (see [Test database isolation](#test-database-isolation)).
- Optional guest login for demos and judging: `GUEST_LOGIN_EMAIL` and `GUEST_LOGIN_PASSWORD`. Create that account once (register it normally); the guest button signs in to it and is hidden when these are unset.

### 3. Run Database Migrations
```bash
# Start local PostgreSQL via Docker
docker compose up -d

# Generate Prisma Client
npm run prisma:generate

# Run Prisma Migrations
npm run prisma:migrate
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`. Test the health check endpoint:
```bash
curl http://localhost:3000/health
```

---

## 📜 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts server in watch mode using `tsx` |
| `npm run build` | Compiles TypeScript into `dist/` |
| `npm run start` | Runs compiled production server (`dist/server.js`) |
| `npm run prisma:generate` | Generates Prisma client types |
| `npm run prisma:migrate` | Applies database migrations in development |
| `npm run lint` | Runs ESLint across all backend source files |
| `npm run format` | Formats code with Prettier |
| `npm run test` | Executes Vitest test suite |

---

## 🧪 Testing Strategy

Backend testing encompasses unit and integration suites run via Vitest:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npx vitest

# Run with coverage report
npx vitest run --coverage
```

### Test database isolation

Integration suites `TRUNCATE` every table (including `User`), so they must never touch a real database. The test runner therefore **ignores `DATABASE_URL`** and uses only `TEST_DATABASE_URL`, falling back to `postgresql://postgres:postgres@localhost:5433/worksim_test`. Before any test runs, a guard refuses to start unless:

- the host is local (`localhost`, `127.0.0.1`, `::1`, or a host listed in `TEST_DATABASE_ALLOWED_HOSTS`),
- the database name contains a `test` segment (`worksim_test`, `test_db`),
- `NODE_ENV` is not `production`,
- and, for integration suites, the server itself reports a `current_database()` that looks like a test database.

One-time local setup:

```bash
docker compose up -d db                              # new volumes also create worksim_test automatically
docker compose exec db createdb -U postgres worksim_test   # only needed if your volume already existed
npm run test:db:prepare                              # applies migrations to the test database only
```

Never point `TEST_DATABASE_URL` at a hosted database. For extra protection, give the production app a database role that does not have the `TRUNCATE` privilege.

- **Authentication & Security Tests:** Verifies cookie flags, refresh token single-use rotation, CSRF origin verification, and password hashing.
- **Middleware & Guard Tests:** Verifies correct short-circuiting on unpaid subscriptions, missing GitHub connections, or missing starter repos.
- **Database & Concurrency Tests:** Tests atomic single-use token claiming under simulated race conditions.
- **Integration Tests:** Verifies complete request/response flows against mock database and third-party APIs.

---

## 📄 License

This backend is open-source software licensed under the **[MIT License](../LICENSE)**.
