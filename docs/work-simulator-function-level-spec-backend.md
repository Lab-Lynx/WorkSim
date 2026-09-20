# 8. Function-Level Specification — Backend

Project: Work Simulator · Links back to: [7. Folder & File Structure]

This is the backend implementation-level specification for the Work Simulator V1. It is written against Docs 2, 4, 5 and the backend portions of Doc 7. It is intentionally split from the frontend Function-Level Specification.

The implementation AI must use this document together with [5. API Specification], [4. Database Requirements & ER Diagram], the real existing backend template/code, and the backend test plan.

**Important source-of-truth rules**

- Do not redesign the already-built access/refresh-cookie authentication mechanism.
- Do not introduce GitHub-only login. GitHub is a separate connection used for repository access.
- Do not store raw GitHub or payment secrets in logs or API responses.
- Do not add Django or Voxide functionality in V1.
- Do not invent a ticket-template selection algorithm. `Q-09` remains open; the implementation must expose that choice as a small isolated strategy/configuration point rather than silently inventing product behavior.
- Do not invent Chapa recurring-billing mechanics beyond the behavior already specified. `Q-05` remains open.
- Do not invent GitHub webhook attachment/scope behavior. `Q-08` remains open and must be isolated behind the GitHub integration boundary.
- Do not invent password-reset session revocation. `Q-11` remains open.
- Do not invent cookie `SameSite` or CSRF behavior. `Q-12` remains open and must be verified against the existing auth implementation before deployment.
- Do not invent submission timeout values. `Q-13` remains open; the timeout mechanism must be configurable.
- Do not invent the mentor message limit or maximum message length. `Q-10` remains open; keep both configurable.
- Do not make the client choose submission attempt 1 or 2. The server derives the attempt from ticket state.
- Do not make the client choose the mentor hint level. The server derives it from the stored transcript.
- Do not activate a subscription from the Chapa browser return URL. Only the verified webhook can activate it.
- Do not score attempt 1.
- Do not create a third submission attempt.
- Do not create a `scored` ticket state.
- All ticket ownership checks must fail as `404`, not reveal that another user's ticket exists.

---

## 8.1 Backend Function Map

The backend specification is grouped by implementation responsibility rather than by endpoint number.

| Area | Main files | High-scrutiny functions |
|---|---|---|
| Authentication | `src/services/auth.service.ts`, auth controller/routes | register, login, refresh, logout, logout-all, verify, resend, forgot, reset, change-password |
| User/profile | `src/services/user.service.ts`, users controller/routes | get/update current user |
| Email | `src/services/email.service.ts` | verification/reset/failure email dispatch |
| Subscription/payment | `src/services/subscription.service.ts`, Chapa integration, webhook controller | checkout, webhook processing, status, cancel, payment history |
| GitHub | `src/services/github.service.ts`, GitHub integration, OAuth controller | OAuth URL/callback, connection, disconnect, repo creation |
| Tickets | `src/services/ticket.service.ts` | assign, current/detail, start, abandon |
| Ticket generation | `src/services/ticket-generation.service.ts` | template loading, Gemini ticket generation |
| Mentor | `src/services/mentor.service.ts` | send message, hint-stage calculation, Gemini call |
| Submission | `src/services/submission.service.ts` | submit/resubmit, status/detail, retry |
| Evaluation | `src/services/evaluation.service.ts` | evaluator input, Groq evaluation, rubric calculation |
| GitHub CI webhook | `src/services/github-webhook.service.ts` | signature verification, workflow-run processing |
| Profile | `src/services/profile.service.ts` | completed-ticket projection |
| Shared backend | middleware, serializers, error helpers | validation/auth/subscription/GitHub/ownership guards |
| Configuration | backend config files | AI, Chapa, GitHub, email, limits, timeouts |

---

# 8.2 Authentication & Account

## registerUser — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `registerUser(name: string, email: string, password: string): Promise<User>` |
| Purpose | Create the platform account and persist a bcrypt password hash. |
| Inputs | `name`, `email`, plaintext `password`. |
| Output | Created `User` domain record; callers must serialize only the public fields required by the endpoint. |
| Throws | `ApiError(409, "Email already in use")` for a unique-email conflict; validation is handled before service invocation where applicable. |
| Side effects | Prisma `User` insert; password hashing; then verification-email dispatch is performed by the endpoint/application flow. |
| Rules | Trim/normalize the email consistently with the existing auth implementation. Never store plaintext password. Never log password. `name` is required by API validation even though DB column is nullable for existing rows. |
| Edge cases | Concurrent duplicate registration must still resolve to a 409 through the DB unique constraint. Email-send failure must not roll back account creation because EP-01 explicitly permits resend through EP-07. |
| Test file | `tests/services/auth.service.test.ts` |

## authenticateUser — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `authenticateUser(email: string, password: string): Promise<User>` |
| Purpose | Validate credentials and return the user used to establish the existing cookie session. |
| Inputs | Email and plaintext password. |
| Output | User record. |
| Throws | `ApiError(401, "Invalid email or password")` for either unknown email or wrong password. |
| Side effects | None in the service beyond reads; failed-attempt rate limiting remains middleware/infrastructure behavior already present. |
| Rules | Do not reveal which credential was wrong. Never return/log `passwordHash`. Do not gate login on `emailVerifiedAt`; Q-04 is unresolved. |
| Edge cases | Missing user, malformed stored hash, concurrent account changes. All credential failures must have the same externally visible authentication error. |
| Test file | `tests/services/auth.service.test.ts` |

## createSession — `src/services/auth.service.ts` / existing auth implementation

| Field | Detail |
|---|---|
| Signature | `createSession(user: User, response: Response): Promise<void>` |
| Purpose | Preserve the existing access-token + refresh-token httpOnly-cookie login behavior. |
| Inputs | Authenticated user and HTTP response. |
| Output | None. |
| Throws | Existing auth errors only. |
| Side effects | Creates hashed refresh-token record and sets access/refresh cookies according to the already-built implementation. |
| Rules | Do not move tokens to localStorage or response JSON. Do not redesign rotation. |
| Edge cases | Cookie configuration must remain compatible with the existing deployment; verify Q-12 before production. |
| Test file | Existing auth integration tests plus `tests/services/auth.service.test.ts` where applicable. |

## refreshSession — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `refreshSession(rawRefreshToken: string): Promise<RefreshSessionResult>` |
| Purpose | Validate, rotate and revoke the refresh token and issue a new access/refresh pair using the existing mechanism. |
| Inputs | Raw refresh token read from the refresh cookie. |
| Output | Session/token result consumed by the existing cookie setter. |
| Throws | 401 for missing, expired, revoked or already-rotated token. |
| Side effects | Refresh-token DB read/update/create; old token revoked; new refresh token hashed before storage. |
| Rules | Never persist the raw refresh token. Rotation must be atomic enough that the same refresh token cannot be successfully reused. |
| Edge cases | Concurrent refresh requests, expired token, revoked token, token already rotated. |
| Test file | `tests/services/auth.service.test.ts`, auth integration tests. |

## revokeCurrentSession — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `revokeCurrentSession(rawRefreshToken: string): Promise<void>` |
| Purpose | Revoke the current refresh-token session for EP-04. |
| Inputs | Raw refresh token from cookie. |
| Output | None. |
| Throws | 401 if the session cannot be authenticated according to the existing auth behavior. |
| Side effects | Sets `RefreshToken.revokedAt`; caller clears auth cookies. |
| Rules | Do not delete unrelated sessions. |
| Edge cases | Already revoked token; expired token; missing cookie. |
| Test file | `tests/services/auth.service.test.ts` |

## revokeAllSessions — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `revokeAllSessions(userId: string): Promise<void>` |
| Purpose | Revoke all active refresh tokens for EP-05. |
| Inputs | Authenticated `userId`. |
| Output | None. |
| Throws | None for a valid authenticated user. |
| Side effects | Updates all non-revoked refresh-token rows for the user. |
| Rules | Do not delete refresh-token history. Set `revokedAt`. |
| Edge cases | Zero active sessions is still a successful operation. |
| Test file | `tests/services/auth.service.test.ts` |

## verifyEmail — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `verifyEmail(rawToken: string): Promise<Date>` |
| Purpose | Consume an email-verification token and set `User.emailVerifiedAt`. |
| Inputs | Raw token from the verification link. |
| Output | Verification timestamp. |
| Throws | 400 for unknown/malformed token; 410 for expired or already-used token. |
| Side effects | Reads hashed token; sets `usedAt`; updates `User.emailVerifiedAt`. |
| Rules | Hash the supplied token before lookup. Token consumption and user update should be atomic. |
| Edge cases | Expired token, used token, concurrent double-click, user already verified. A used token must not be reusable. |
| Test file | `tests/services/auth.service.test.ts` |

## resendVerificationEmail — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `resendVerificationEmail(email: string): Promise<void>` |
| Purpose | Send a new verification link without revealing whether an account exists. |
| Inputs | Valid email. |
| Output | None. |
| Throws | Validation/rate-limit errors are handled at the endpoint/middleware boundary. |
| Side effects | Creates a new hashed `EmailVerificationToken`; sends verification email when an unverified user exists. |
| Rules | EP-07 must return the same success response whether the account exists, is already verified, or does not exist. Do not expose account existence through timing/logging/API behavior beyond ordinary operational logging. |
| Edge cases | Unknown email, already verified account, previous unused tokens, email provider failure. |
| Test file | `tests/services/auth.service.test.ts` |

## requestPasswordReset — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `requestPasswordReset(email: string): Promise<void>` |
| Purpose | Create a one-time password-reset token and send the reset email without revealing account existence. |
| Inputs | Email. |
| Output | None. |
| Side effects | Creates hashed `PasswordResetToken`; sends email if account exists. |
| Rules | Fixed expiration window must come from configuration, not be scattered in code. |
| Edge cases | Unknown email, existing active reset tokens, email-send failure. |
| Test file | `tests/services/auth.service.test.ts` |

## resetPassword — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `resetPassword(rawToken: string, newPassword: string): Promise<void>` |
| Purpose | Consume a valid reset token and replace the user's password hash. |
| Inputs | Raw reset token and plaintext new password. |
| Output | None. |
| Throws | 400 unknown/malformed token; 410 expired/used token; validation error for invalid password. |
| Side effects | Updates `User.passwordHash`; marks token `usedAt`. Session revocation after reset remains Q-11 and must not be invented here. |
| Rules | Verify token expiry and unused state before changing the password. Hash with bcrypt. Never log plaintext password/token. |
| Edge cases | Double-submit, concurrent token use, token expiry between read and update. Token consumption and password update should be transactional. |
| Test file | `tests/services/auth.service.test.ts` |

## changePassword — `src/services/auth.service.ts`

| Field | Detail |
|---|---|
| Signature | `changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>` |
| Purpose | Change password for an authenticated user after checking the current password. |
| Inputs | User ID, current plaintext password, new plaintext password. |
| Output | None. |
| Throws | `ApiError(400, "Current password is incorrect")`; validation errors for new password. |
| Side effects | Updates password hash. Session revocation behavior is Q-11 and is not assumed. |
| Rules | Current password must be verified before mutation. |
| Edge cases | Wrong current password, same new password, concurrent password change. |
| Test file | `tests/services/auth.service.test.ts` |

---

# 8.3 User/Profile Functions

## getCurrentUser — `src/services/user.service.ts`

| Field | Detail |
|---|---|
| Signature | `getCurrentUser(userId: string): Promise<User>` |
| Purpose | Return the authenticated user's public account data. |
| Inputs | Authenticated user ID. |
| Output | User. |
| Throws | 401/404 according to existing authenticated-user convention. |
| Side effects | None. |
| Rules | Never include `passwordHash`. |
| Test file | `tests/services/user.service.test.ts` |

## updateDisplayName — `src/services/user.service.ts`

| Field | Detail |
|---|---|
| Signature | `updateDisplayName(userId: string, name: string): Promise<User>` |
| Purpose | Update only the user's display name. |
| Inputs | User ID and validated name. |
| Output | Updated public User. |
| Throws | 404 only if authenticated user no longer exists; validation is endpoint-level. |
| Side effects | Updates `User.name`. |
| Rules | Email and password are not changed here. |
| Edge cases | Whitespace-only name must fail validation; concurrent updates use normal last-write behavior unless the existing ORM layer provides optimistic locking. |
| Test file | `tests/services/user.service.test.ts` |

---

# 8.4 Transactional Email

## sendVerificationEmail — `src/services/email.service.ts`

| Field | Detail |
|---|---|
| Signature | `sendVerificationEmail(to: string, token: string): Promise<void>` |
| Purpose | Send the verification link generated by the auth flow. |
| Inputs | Recipient email and raw one-time token. |
| Output | None. |
| Throws | Email-provider error. |
| Side effects | External email send only. |
| Rules | The raw token may be placed in the intended verification URL but must never be logged. |
| Edge cases | Provider timeout/failure. Registration must remain successful if this send fails. |
| Test file | `tests/services/email.service.test.ts` |

## sendPasswordResetEmail — `src/services/email.service.ts`

Same contract as `sendVerificationEmail`, but for the reset URL. Token must never be logged or persisted in plaintext.

**Test file:** `tests/services/email.service.test.ts`

## sendPaymentFailureEmail — `src/services/email.service.ts`

| Field | Detail |
|---|---|
| Signature | `sendPaymentFailureEmail(to: string, currentPeriodEnd: Date): Promise<void>` |
| Purpose | Notify a user when a recurring payment fails. |
| Inputs | User email and access-end timestamp. |
| Output | None. |
| Side effects | External email send. |
| Rules | Do not include sensitive payment data or Chapa secrets. |
| Edge cases | Email provider failure must not undo a successfully persisted payment/subscription state transition; log the operational failure. |
| Test file | `tests/services/email.service.test.ts` |

---

# 8.5 Subscription & Chapa

## createCheckout — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `createCheckout(userId: string): Promise<{ checkoutUrl: string }>` |
| Purpose | Create a pending payment and request Chapa's hosted checkout. |
| Inputs | Authenticated user ID. |
| Output | Hosted Chapa checkout URL. |
| Throws | 409 if an `active`/`past_due` subscription already exists; 502 if Chapa checkout creation fails. |
| Side effects | Reads subscription state; creates `Payment(status=pending)` with server-configured amount/currency; calls Chapa. |
| Rules | Amount/currency come from server configuration, never request input. Store only Chapa transaction reference and billing fields defined by Doc 4. Never store card data. Do not activate subscription here. |
| Edge cases | Concurrent checkout requests, Chapa timeout after payment row creation, duplicate transaction reference, existing canceled subscription with future access. The DB uniqueness and subscription constraints remain authoritative. |
| Test file | `tests/services/subscription.service.test.ts` |

## processChapaWebhook — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `processChapaWebhook(payload: ChapaWebhookPayload): Promise<void>` |
| Purpose | Apply a verified Chapa payment outcome idempotently. |
| Inputs | Parsed verified webhook payload containing transaction reference and payment outcome. |
| Output | None. |
| Throws | Malformed payload error; signature verification occurs before this function. |
| Side effects | Updates `Payment`; may create/update `Subscription`; may send failure email. |
| Rules | Lookup by unique `chapaTxRef`. `pending → succeeded` sets `paidAt`. First successful payment creates a subscription. Repeated success/failure event after terminal state is a no-op. Unknown reference is logged as warning and acknowledged. |
| Important unresolved behavior | Exact recurring-renewal/subscription-reference mechanics remain Q-05. Do not invent a Chapa subscription API contract. Isolate renewal-specific logic behind the Chapa adapter. |
| Edge cases | Duplicate webhook, unknown transaction, payment already succeeded, payment already failed, concurrent webhook deliveries, failed email after persisted state. |
| Test file | `tests/services/subscription.service.test.ts`, webhook integration tests. |

## getSubscriptionStatus — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `getSubscriptionStatus(userId: string): Promise<{ subscription: Subscription | null; hasAccess: boolean }>` |
| Purpose | Return latest subscription plus paid-access state. |
| Inputs | User ID. |
| Output | Latest subscription and `hasAccess`. |
| Rules | `hasAccess = true` when any subscription has `currentPeriodEnd > now`, regardless of status. |
| Edge cases | No subscription, canceled subscription with remaining period, past-due subscription with remaining period, multiple historical rows. |
| Test file | `tests/services/subscription.service.test.ts` |

## cancelSubscription — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `cancelSubscription(userId: string): Promise<Subscription>` |
| Purpose | Cancel the current active/past-due subscription and stop future Chapa charges. |
| Inputs | User ID. |
| Output | Updated subscription. |
| Throws | 409 if no active/past_due subscription; 502 if Chapa cancellation fails. |
| Side effects | Chapa cancellation call; `Subscription.status=canceled`; `canceledAt=now()`. |
| Rules | Access continues until `currentPeriodEnd`. The exact Chapa cancellation mechanism is Q-05. Do not mark canceled locally if the required Chapa cancellation call failed. |
| Edge cases | Concurrent cancellation, already-canceled subscription, Chapa timeout after cancellation may have succeeded remotely. The adapter must make this operation as idempotent as the provider permits. |
| Test file | `tests/services/subscription.service.test.ts` |

## listPayments — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `listPayments(userId: string): Promise<Payment[]>` |
| Purpose | Return billing history newest first. |
| Inputs | User ID. |
| Output | User-owned payments without Chapa transaction references. |
| Side effects | None. |
| Rules | No pagination in V1. Never expose `chapaTxRef`. |
| Test file | `tests/services/subscription.service.test.ts` |

## hasPaidAccess — `src/services/subscription.service.ts`

| Field | Detail |
|---|---|
| Signature | `hasPaidAccess(userId: string, now?: Date): Promise<boolean>` |
| Purpose | Shared subscription gate for paid-resource operations. |
| Inputs | User ID and optional clock for tests. |
| Output | Boolean. |
| Rules | True when any subscription's `currentPeriodEnd` is in the future. |
| Edge cases | No subscription; canceled-but-not-expired; past_due-but-not-expired; exactly-at-period-end should be false. |
| Test file | `tests/services/subscription.service.test.ts` |

---

# 8.6 GitHub OAuth, Connection & Repository

## createGitHubAuthorizeUrl — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `createGitHubAuthorizeUrl(userId: string): Promise<string>` |
| Purpose | Build a short-lived signed OAuth authorization URL bound to the current user. |
| Inputs | User ID. |
| Output | GitHub authorize URL. |
| Throws | 402 when paid access is missing. |
| Side effects | Creates/signed state using the existing selected state mechanism; no DB table is required by the schema. |
| Rules | Requested scope must come from one configuration value. Exact scope remains Q-08. Never put access tokens in the URL. |
| Edge cases | Existing connection, expired state, configuration missing. |
| Test file | `tests/services/github.service.test.ts` |

## handleGitHubCallback — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `handleGitHubCallback(userId: string, code: string, state: string): Promise<void>` |
| Purpose | Validate OAuth state, exchange code, validate granted scope, encrypt/store token, and create/replace `GitHubConnection`. |
| Inputs | Authenticated user ID, GitHub code and state. |
| Output | None; controller performs redirect. |
| Throws | Typed callback failure categories mapped to `state_invalid`, `scope_invalid`, `exchange_failed`. |
| Side effects | External GitHub token exchange; encrypted `GitHubConnection` write. |
| Rules | State must be bound to the user. Granted scope cannot be broader than requested. Store encrypted token, never raw token in logs. |
| Edge cases | Invalid state, expired state, GitHub exchange failure, user cancels authorization, unexpected scope, reconnecting an existing connection. `access_denied` remains Q-16 and must not be silently treated as a new contract. |
| Test file | `tests/services/github.service.test.ts` |

## getGitHubConnection — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `getGitHubConnection(userId: string): Promise<GitHubConnectionSummary>` |
| Purpose | Return connection status and existing starter repo. |
| Inputs | User ID. |
| Output | `{ connected, githubLogin, repo }`. |
| Rules | Never return `accessTokenEncrypted`. Repo remains visible after connection deletion. |
| Test file | `tests/services/github.service.test.ts` |

## disconnectGitHub — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `disconnectGitHub(userId: string): Promise<void>` |
| Purpose | Delete the platform's `GitHubConnection` row. |
| Inputs | User ID. |
| Output | None. |
| Throws | 404 if not connected. |
| Side effects | Deletes connection row; keeps `StarterRepo`, tickets, submissions and evaluations. Does not revoke GitHub grant at GitHub (A-32). |
| Test file | `tests/services/github.service.test.ts` |

## createStarterRepo — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `createStarterRepo(userId: string, starterTemplate: StarterTemplate, repoName?: string): Promise<StarterRepo>` |
| Purpose | Create the user's one GitHub repository from a supported starter template and persist its metadata. |
| Inputs | User ID, `react` or `node_express`, optional repo name. |
| Output | StarterRepo. |
| Throws | 400 invalid template/name; 402 no paid access; 403 missing/invalid GitHub connection; 409 repo already exists or GitHub name collision; 502 upstream GitHub failure. |
| Side effects | GitHub repository creation/template operation; DB `StarterRepo` insert. |
| Rules | One repo per user. Django is not accepted. If GitHub rejects the stored token, delete the `GitHubConnection` row and return 403. Do not create the DB row until the external repo is successfully created. |
| Edge cases | Concurrent create requests; GitHub succeeds but DB insert fails; GitHub name collision; invalid token; unsupported template. External operation/idempotency handling must avoid silently creating multiple repos. |
| Test file | `tests/services/github.service.test.ts` |

## createTicketBranch — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `createTicketBranch(userId: string, branchName: string, baseBranch: string): Promise<void>` |
| Purpose | Create the ticket branch in the user's starter repository. |
| Inputs | User ID, unique branch name, default/base branch. |
| Output | None. |
| Throws | 403 invalid GitHub connection; 502 GitHub failure. |
| Side effects | GitHub branch creation. |
| Rules | Branch is created before the Ticket row is persisted. Branch name must satisfy DR-09. |
| Edge cases | Branch already exists, stale GitHub token, base branch moved, network timeout. |
| Test file | `tests/services/github.service.test.ts` |

## getBranchSubmissionState — `src/services/github.service.ts`

| Field | Detail |
|---|---|
| Signature | `getBranchSubmissionState(userId: string, branchName: string): Promise<GitHubSubmissionState>` |
| Purpose | Read the user's ticket branch and identify/open/reuse the PR and capture the evaluated commit/diff. |
| Inputs | User ID and ticket branch. |
| Output | PR number/URL, head SHA, diff, branch/default-branch metadata. |
| Throws | 400 when no commits exist beyond default branch; 403 invalid connection; 502 GitHub read failure. |
| Rules | At first submission, reuse an open PR for the branch or create one. Attempt 2 reuses the same PR. |
| Edge cases | No commits, multiple open PRs for same branch, force-push, PR deleted, branch deleted, token revoked. |
| Test file | `tests/services/github.service.test.ts`, submission integration tests. |

---

# 8.7 Ticket Generation & Lifecycle

## loadTicketTemplate — `src/services/ticket-generation.service.ts`

| Field | Detail |
|---|---|
| Signature | `loadTicketTemplate(templateKey: string): TicketTemplate` |
| Purpose | Load a team-authored ticket template from the codebase. |
| Inputs | Template key. |
| Output | Typed template definition containing fixed structure such as category, difficulty, touched files, acceptance criteria structure and test checklist structure. |
| Throws | Internal configuration/template error when key is missing or malformed. |
| Rules | Template definitions are code-owned, not DB rows. Unknown keys must fail loudly. |
| Edge cases | Duplicate keys, malformed template, missing required fields. |
| Test file | `tests/services/ticket-generation.service.test.ts` |

## selectNextTicketTemplate — `src/services/ticket-generation.service.ts`

| Field | Detail |
|---|---|
| Signature | `selectNextTicketTemplate(userId: string): Promise<TicketTemplateSelection>` |
| Purpose | Choose the next team-authored template. |
| Inputs | User ID and available ticket history if the eventual selection strategy needs it. |
| Output | Template key/definition. |
| Important unresolved point | `Q-09` does not define the selection algorithm. Do not invent random/order/difficulty progression as product behavior. Keep the strategy isolated so the team can choose it. |
| Test file | `tests/services/ticket-generation.service.test.ts` |

## generateTicketContent — `src/services/ticket-generation.service.ts`

| Field | Detail |
|---|---|
| Signature | `generateTicketContent(template: TicketTemplate, context: TicketGenerationContext): Promise<TicketContent>` |
| Purpose | Ask Gemini to fill the specific wording/scenario inside the fixed team-authored template structure. |
| Inputs | Template and generation context. |
| Output | Validated `TicketContent`. |
| Throws | Upstream Gemini failure → caller maps to 502 `"Could not generate a ticket, please try again"`. |
| Side effects | Gemini API call only. |
| Rules | Gemini may fill wording/scenario but must not invent or remove the fixed structure. Validate model output against the required `TicketContent` shape before persistence. |
| Edge cases | Malformed model output, missing required field, extra fields, timeout, refusal/error, content inconsistent with template. Invalid generated output must not create a Ticket row. |
| Test file | `tests/services/ticket-generation.service.test.ts` |

## assignNextTicket — `src/services/ticket.service.ts`

| Field | Detail |
|---|---|
| Signature | `assignNextTicket(userId: string): Promise<Ticket>` |
| Purpose | Atomically enforce the one-active-ticket rule, generate ticket content, create the GitHub branch, and persist the assigned ticket. |
| Inputs | User ID. |
| Output | Assigned Ticket. |
| Throws | 402 no paid access; 403 GitHub missing/invalid; 409 no repo or active ticket; 502 generation/branch failure. |
| Side effects | DB read; Gemini call; GitHub branch creation; Ticket insert. |
| Rules | Required order: verify access → connection → repo → active-ticket absence → select template → generate content → create branch → create Ticket. Ticket must not exist if generation or branch creation fails. DR-01 is the final concurrency guard. |
| Edge cases | Two simultaneous requests, Gemini succeeds/GitHub fails, GitHub succeeds/DB fails, generated content invalid, branch-name collision. Do not leave a Ticket row without its required branch. |
| Test file | `tests/services/ticket.service.test.ts` |

## getCurrentTicket — `src/services/ticket.service.ts`

| Field | Detail |
|---|---|
| Signature | `getCurrentTicket(userId: string): Promise<Ticket | null>` |
| Purpose | Return the user's active ticket, where active excludes `done` and `abandoned`. |
| Inputs | User ID. |
| Output | Ticket or null. |
| Rules | Use DB state, not memory. Include the ticket content required by EP-24. |
| Edge cases | Corrupt state with multiple active tickets should be detectable by DR-01; service should not silently choose one. |
| Test file | `tests/services/ticket.service.test.ts` |

## getTicketById — `src/services/ticket.service.ts`

| Field | Detail |
|---|---|
| Signature | `getTicketById(userId: string, ticketId: string): Promise<TicketWithSubmissions>` |
| Purpose | Return an owned ticket and submission summaries, including done/abandoned history. |
| Inputs | User ID and ticket ID. |
| Output | Ticket plus 0–2 submissions without full diff. |
| Throws | 404 `"Ticket not found"` for missing or non-owned ticket. |
| Rules | Never expose another user's ticket. Do not include diff in this query; EP-31 owns diff retrieval. |
| Test file | `tests/services/ticket.service.test.ts` |

## startTicket — `src/services/ticket.service.ts`

| Field | Detail |
|---|---|
| Signature | `startTicket(userId: string, ticketId: string): Promise<Ticket>` |
| Purpose | Move an owned ticket from `assigned` to `in_progress`. |
| Inputs | User ID and ticket ID. |
| Output | Updated Ticket. |
| Throws | 402 no paid access; 404 not found/not owned; 409 if status is not `assigned`. |
| Side effects | Ticket status update. |
| Rules | Transition must be conditional on current status to avoid stale concurrent requests. |
| Test file | `tests/services/ticket.service.test.ts` |

## abandonTicket — `src/services/ticket.service.ts`

| Field | Detail |
|---|---|
| Signature | `abandonTicket(userId: string, ticketId: string): Promise<{ abandonedTicketId: string; newTicket: Ticket | null }>` |
| Purpose | Mark an assigned/in-progress ticket abandoned and attempt to issue a replacement. |
| Inputs | User ID and ticket ID. |
| Output | Abandoned ID plus replacement or null. |
| Throws | 402; 403; 404; 409 after submission. |
| Side effects | Updates ticket to `abandoned`, sets `abandonedAt`; may create a replacement ticket and branch. |
| Rules | Abandonment stands even if replacement generation/branch creation fails. Mentor history and branch remain. |
| Edge cases | Concurrent abandon/start/submit; replacement generation failure; replacement branch failure. The active-ticket DB constraint must remain consistent. |
| Test file | `tests/services/ticket.service.test.ts` |

---

# 8.8 AI Mentor

## getMentorHintStage — `src/services/mentor.service.ts`

| Field | Detail |
|---|---|
| Signature | `getMentorHintStage(messages: MentorMessage[]): MentorHintStage` |
| Purpose | Determine the next progressive-hint stage from the stored transcript. |
| Inputs | Ordered mentor transcript. |
| Output | Internal hint stage. |
| Rules | The client cannot select the stage. The sequence must follow FR-38: ask what was tried → conceptual hint → relevant file/function → more specific suggestion only when the conversation warrants it. |
| Important | The exact number of stages is not independently fixed beyond this progression; do not expose a new public contract for it. |
| Test file | `tests/services/mentor.service.test.ts` |

## sendMentorMessage — `src/services/mentor.service.ts`

| Field | Detail |
|---|---|
| Signature | `sendMentorMessage(userId: string, ticketId: string, content: string): Promise<{ userMessage: MentorMessage; mentorMessage: MentorMessage }>` |
| Purpose | Validate ticket access/state/rate limit, build mentor context, call Gemini, then persist both messages. |
| Inputs | User ID, ticket ID, validated message content. |
| Output | Both persisted messages. |
| Throws | 402, 404, 409 when ticket is not `in_progress`, 429 rate limit, 502 Gemini failure. |
| Side effects | Gemini call; two `MentorMessage` inserts after successful response. |
| Rules | If Gemini fails, neither the user message nor mentor reply is persisted. Do not let client select hint level. Full transcript is the source for context. |
| Edge cases | Concurrent messages, rate-limit race, Gemini timeout, malformed Gemini response, empty content, ticket transitions while AI call is running. |
| Test file | `tests/services/mentor.service.test.ts` |

## callMentorModel — `src/integrations/gemini.ts`

| Field | Detail |
|---|---|
| Signature | `callMentorModel(input: MentorModelInput): Promise<string>` |
| Purpose | Isolate Gemini SDK/API behavior from business logic. |
| Inputs | Ticket content, transcript, current user message, calculated hint stage. |
| Output | Plain-text mentor response. |
| Throws | Provider-specific error normalized by the integration boundary. |
| Rules | API key from server config; never log prompt contents if they can contain user code/secrets. |
| Edge cases | timeout, rate limit, malformed provider response, provider outage. |
| Test file | `tests/integrations/gemini.test.ts` |

## canSendMentorMessage — `src/services/mentor.service.ts`

| Field | Detail |
|---|---|
| Signature | `canSendMentorMessage(ticketId: string, now?: Date): Promise<boolean>` |
| Purpose | Enforce the configured per-ticket mentor limit. |
| Inputs | Ticket ID and optional clock. |
| Output | Boolean. |
| Rules | Count is derived from `MentorMessage` rows as required by FR-41/Doc 4. Exact limit/window remains Q-10. |
| Test file | `tests/services/mentor.service.test.ts` |

---

# 8.9 Submission Pipeline

## determineSubmissionAttempt — `src/services/submission.service.ts`

| Field | Detail |
|---|---|
| Signature | `determineSubmissionAttempt(ticketStatus: TicketStatus): 1 | 2` |
| Purpose | Derive the submission pass from ticket state. |
| Inputs | Current ticket status. |
| Output | Attempt 1 for `in_progress`; attempt 2 for `submitted_v1`. |
| Throws | Conflict for every other ticket status. |
| Rules | The client never supplies the attempt. |
| Test file | `tests/services/submission.service.test.ts` |

## submitWork — `src/services/submission.service.ts`

| Field | Detail |
|---|---|
| Signature | `submitWork(userId: string, ticketId: string): Promise<Submission>` |
| Purpose | Read the ticket branch from GitHub, reuse/create the PR, capture head SHA/diff, create the correct submission row and advance ticket state. |
| Inputs | User ID and ticket ID. |
| Output | Submission with `awaiting_ci` status. |
| Throws | 400 no commits; 402 no access; 403 GitHub invalid; 404 not owned; 409 wrong ticket state or attempt-2 still processing/failed; 502 GitHub failure. |
| Side effects | GitHub reads/PR creation; Submission insert; Ticket state transition. |
| Rules | Attempt 1 only from `in_progress`; attempt 2 only from `submitted_v1` after attempt 1 completed. Attempt 2 reuses the same PR/branch. Store full diff. |
| Edge cases | Double submit, concurrent resubmit, PR already open, PR deleted, force-push, CI already completed before submission, GitHub token revoked. |
| Test file | `tests/services/submission.service.test.ts` |

## getSubmission — `src/services/submission.service.ts`

| Field | Detail |
|---|---|
| Signature | `getSubmission(userId: string, ticketId: string, attempt: 1 | 2, includeDiff: boolean): Promise<SubmissionView>` |
| Purpose | Return submission status/results for polling or history. |
| Inputs | User ID, ticket ID, attempt, diff flag. |
| Output | Submission; diff only when requested. |
| Throws | 404 `"Submission not found"` for missing/non-owned. |
| Rules | Do not load diff during normal polling unless requested. |
| Edge cases | Submission absent, processing, failed, completed attempt 1 with null scores, completed attempt 2 with scores. |
| Test file | `tests/services/submission.service.test.ts` |

## retrySubmission — `src/services/submission.service.ts`

| Field | Detail |
|---|---|
| Signature | `retrySubmission(userId: string, ticketId: string, attempt: 1 | 2): Promise<Submission>` |
| Purpose | Restart the pipeline for the same failed submission. |
| Inputs | User ID, ticket ID, attempt. |
| Output | Same Submission row with status reset to processing. |
| Throws | 402; 404; 409 if status is not `failed`. |
| Rules | Retry is not a new attempt. Never create a third Submission row. Preserve the original attempt number, PR, SHA and ticket state. |
| Edge cases | Concurrent retries, provider becomes available during retry, stale failed status. Conditional update should prevent duplicate pipeline starts. |
| Test file | `tests/services/submission.service.test.ts` |

---

# 8.10 Evaluation

## buildEvaluationInput — `src/services/evaluation.service.ts`

| Field | Detail |
|---|---|
| Signature | `buildEvaluationInput(submission: Submission, ticket: Ticket, transcript?: MentorMessage[]): EvaluationInput` |
| Purpose | Build the exact evaluator context from the ticket, diff, CI result and, on attempt 2, mentor transcript. |
| Inputs | Submission, ticket, optional transcript. |
| Output | Evaluator input. |
| Rules | Evaluator must receive both diff and CI result. Attempt 2 receives mentor transcript for the 15% problem-solving/communication category. |
| Edge cases | Missing CI result, missing transcript, oversized diff, malformed ticket content. |
| Test file | `tests/services/evaluation.service.test.ts` |

## evaluateSubmission — `src/services/evaluation.service.ts`

| Field | Detail |
|---|---|
| Signature | `evaluateSubmission(submissionId: string): Promise<Evaluation>` |
| Purpose | Produce feedback for both passes and scores only for attempt 2. |
| Inputs | Submission ID. |
| Output | Persisted Evaluation. |
| Throws | Provider/integration error; caller converts to failed submission state and retryable response. |
| Side effects | Groq call; Evaluation insert. |
| Rules | Attempt 1: feedback required, all score fields null, no total. Attempt 2: all four category scores required and 0–100, weighted total required. Weights are exactly 40/25/20/15. |
| Edge cases | Invalid evaluator output, score out of range, missing category, non-numeric score, evaluator timeout, duplicate evaluation attempt. |
| Test file | `tests/services/evaluation.service.test.ts` |

## calculateWeightedScore — `src/services/evaluation.service.ts`

| Field | Detail |
|---|---|
| Signature | `calculateWeightedScore(scores: { requirementsMet: number; correctnessTests: number; codeQuality: number; problemSolving: number }): Decimal` |
| Purpose | Calculate the fixed final score. |
| Inputs | Four 0–100 category scores. |
| Output | Decimal 0–100 using weights 0.40, 0.25, 0.20, 0.15. |
| Rules | Do not read weights from the client. Round/store according to the DB/API decimal convention. |
| Edge cases | 0, 100, decimal category values if provider returns them, invalid ranges. |
| Test file | `tests/services/evaluation.service.test.ts` |

## callEvaluatorModel — `src/integrations/groq.ts`

| Field | Detail |
|---|---|
| Signature | `callEvaluatorModel(input: EvaluationInput): Promise<EvaluatorOutput>` |
| Purpose | Isolate Groq provider behavior. |
| Inputs | Structured evaluator input. |
| Output | Parsed evaluator output before DB persistence. |
| Rules | Provider key/config stays server-side. Output must be validated by application code. |
| Edge cases | Timeout, provider outage, malformed output, rate limit. |
| Test file | `tests/integrations/groq.test.ts` |

---

# 8.11 GitHub CI Webhook

## verifyGitHubWebhookSignature — `src/services/github-webhook.service.ts`

| Field | Detail |
|---|---|
| Signature | `verifyGitHubWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean` |
| Purpose | Verify `X-Hub-Signature-256` against the raw request body. |
| Inputs | Raw body and signature header. |
| Output | Boolean. |
| Rules | Must run before parsing the webhook as JSON. Use configured webhook secret. Invalid/missing signature means no state mutation. |
| Edge cases | Missing header, malformed header, wrong secret, altered body, replay. |
| Test file | `tests/services/github-webhook.service.test.ts` |

## processWorkflowRunWebhook — `src/services/github-webhook.service.ts`

| Field | Detail |
|---|---|
| Signature | `processWorkflowRunWebhook(event: GitHubWorkflowRunEvent): Promise<void>` |
| Purpose | Match a completed GitHub Actions run to a submission, store CI result, invoke evaluation, and finish the ticket when attempt 2 is successfully scored. |
| Inputs | Verified parsed GitHub `workflow_run` event. |
| Output | None. |
| Side effects | Submission update; Evaluation creation; Ticket completion on attempt 2; logs. |
| Rules | Match by repository full name + head commit. Ignore events with no matching submission. `success` → `ciPassed=true`; `failure` → `false`; other conclusions mark submission failed. Then `evaluating` → Groq → Evaluation → `completed`. Attempt 2 completion moves ticket to `done` and sets `completedAt`. |
| Important unresolved point | Exact webhook registration/scope remains Q-08. Keep registration outside this state-processing function. |
| Edge cases | Duplicate webhook, event before submission exists, canceled/timed-out workflow, evaluator failure, duplicate evaluation, concurrent event deliveries. Processing must be idempotent. |
| Test file | `tests/services/github-webhook.service.test.ts` |

## handleSubmissionTimeout — `src/services/github-webhook.service.ts`

| Field | Detail |
|---|---|
| Signature | `handleSubmissionTimeout(submissionId: string): Promise<void>` |
| Purpose | Mark a submission `failed` when the configured CI/evaluator timeout expires. |
| Inputs | Submission ID. |
| Output | None. |
| Rules | Timeout duration comes from configuration because Q-13 is unresolved. Only non-terminal submissions may transition to failed. |
| Edge cases | Workflow finishes just before timeout, duplicate timeout job, already completed submission. Use conditional state transition. |
| Test file | `tests/services/github-webhook.service.test.ts` |

---

# 8.12 Experience Profile

## getExperienceProfile — `src/services/profile.service.ts`

| Field | Detail |
|---|---|
| Signature | `getExperienceProfile(userId: string): Promise<ProfileItem[]>` |
| Purpose | Return every completed ticket newest first with final evaluation summary. |
| Inputs | User ID. |
| Output | Done tickets only; abandoned tickets excluded. |
| Rules | Profile is derived from Ticket + Submission + Evaluation. No separate profile table. Only attempt-2 final evaluation is shown as the profile score. |
| Edge cases | Done ticket missing attempt-2 evaluation should be treated as data-integrity failure rather than silently showing an incomplete credential-like result. |
| Test file | `tests/services/profile.service.test.ts` |

---

# 8.13 API Controllers

Controllers must stay thin. They parse request context, call the service, serialize the response, and let centralized error middleware handle `ApiError`.

## Authentication controller — `src/controllers/auth.controller.ts`

### register
- **Signature:** `(req: Request, res: Response, next: NextFunction) => Promise<void>`
- Validate body through `validate.middleware`.
- Call `registerUser`.
- Create/send verification email through the application flow.
- Return EP-01's exact 201 envelope.
- Never return `passwordHash`.
- On email-send failure, preserve the created account and still return successful registration according to EP-01.

### login
- Call `authenticateUser`.
- Establish the already-built access/refresh cookie session.
- Return public User.
- Preserve 429 behavior from `authLimiter`.

### refresh
- Read refresh cookie only.
- Call existing refresh/rotation service.
- Set new cookies.
- Return EP-03 envelope.

### logout
- Authenticate session.
- Revoke current refresh token.
- Clear cookies.

### logoutAll
- Authenticate session.
- Call `revokeAllSessions`.
- Clear current cookies.

### verifyEmail
- Validate token body.
- Call `verifyEmail`.
- Return timestamp.

### resendVerification
- Validate email.
- Call `resendVerificationEmail`.
- Always return EP-07's non-enumerating success message.

### forgotPassword
- Validate email.
- Call `requestPasswordReset`.
- Always return EP-08's non-enumerating success message.

### resetPassword
- Validate token/password.
- Call `resetPassword`.
- Return EP-09 response.

### changePassword
- Authenticate user.
- Validate current/new passwords.
- Call `changePassword`.
- Return EP-10 response.

**Test file:** `tests/controllers/auth.controller.test.ts`

---

## User controller — `src/controllers/user.controller.ts`

### getMe
- Call `getCurrentUser(req.user.id)`.
- Return EP-11 envelope.
- Serialize public User only.

### updateMe
- Validate `name`.
- Call `updateDisplayName`.
- Return EP-12 envelope.

**Test file:** `tests/controllers/user.controller.test.ts`

---

## Subscription controller — `src/controllers/subscription.controller.ts`

### createCheckout
- Require authenticated user.
- Call `createCheckout`.
- Return 201 checkout URL.
- Never read price/card data from request.

### getSubscription
- Call `getSubscriptionStatus`.
- Return subscription + `hasAccess`.

### cancelSubscription
- Call `cancelSubscription`.
- Return updated public Subscription.

### getPayments
- Call `listPayments`.
- Serialize payment history without Chapa reference.

**Test file:** `tests/controllers/subscription.controller.test.ts`

---

## Chapa webhook controller — `src/controllers/webhooks/chapa.controller.ts`

### handleChapaWebhook
- Receive raw request body.
- Verify signature before JSON business processing.
- Reject invalid signature with 401 and no mutation.
- Validate required transaction reference/outcome.
- Call `processChapaWebhook`.
- Return 200 for valid/unknown/idempotently repeated events.
- Log received/verified/rejected webhook events distinctly.

**Test file:** `tests/controllers/webhooks/chapa.controller.test.ts`

---

## GitHub controller — `src/controllers/github.controller.ts`

### connect
- Require auth + paid access.
- Call `createGitHubAuthorizeUrl`.
- Return authorize URL.

### callback
- Read `code` and `state`.
- Validate session/state.
- Call `handleGitHubCallback`.
- Redirect to frontend `/github?github=connected`.
- On known failure redirect with `github=error&reason=...`.
- Never return JSON for callback failures.

### getConnection
- Return connection summary and repo.

### disconnect
- Call `disconnectGitHub`.
- Return 200.

### createRepo
- Validate starter template and repo name.
- Require paid access + GitHub connection.
- Call `createStarterRepo`.
- Return repo summary.

**Test file:** `tests/controllers/github.controller.test.ts`

---

## Ticket controller — `src/controllers/ticket.controller.ts`

### assignTicket
- Require paid access + GitHub + repo.
- Call `assignNextTicket`.
- Return 201.

### currentTicket
- Call `getCurrentTicket`.
- Return ticket or null.

### getTicket
- Validate UUID.
- Call `getTicketById`.
- Return 404 for missing/non-owned.

### startTicket
- Require paid access.
- Call `startTicket`.
- Return 200.

### abandonTicket
- Require paid access + GitHub + repo.
- Call `abandonTicket`.
- Return abandoned ID + replacement ticket/null.

**Test file:** `tests/controllers/ticket.controller.test.ts`

---

## Mentor controller — `src/controllers/mentor.controller.ts`

### sendMessage
- Validate content.
- Require paid access.
- Call `sendMentorMessage`.
- Return both messages with 201.
- Never expose provider internals.

### getMessages
- Call mentor-history service.
- Return oldest-first messages for any owned ticket status.

**Test file:** `tests/controllers/mentor.controller.test.ts`

---

## Submission controller — `src/controllers/submission.controller.ts`

### submit
- Require paid access + GitHub + repo.
- Call `submitWork`.
- Return 202.
- Do not accept `attempt` from request.

### getSubmission
- Validate attempt is exactly 1 or 2.
- Parse `includeDiff` boolean.
- Call `getSubmission`.

### retry
- Validate attempt.
- Require paid access.
- Call `retrySubmission`.
- Return 202.

**Test file:** `tests/controllers/submission.controller.test.ts`

---

## GitHub webhook controller — `src/controllers/webhooks/github.controller.ts`

### handleWorkflowRun
- Receive raw body.
- Verify `X-Hub-Signature-256`.
- Read `X-GitHub-Event`.
- Ignore non-`workflow_run` or non-completed events with 200.
- Acknowledge valid webhook promptly.
- Dispatch verified event to `processWorkflowRunWebhook`.
- Invalid signature produces 401 and no mutation.

**Test file:** `tests/controllers/webhooks/github.controller.test.ts`

---

## Profile controller — `src/controllers/profile.controller.ts`

### getProfile
- Call `getExperienceProfile`.
- Return EP-34 envelope.
- Only completed tickets appear.

**Test file:** `tests/controllers/profile.controller.test.ts`

---

# 8.14 Middleware & Shared Backend Functions

## requireAuth — existing auth middleware

**Purpose:** Validate the access-token cookie and attach authenticated user context.

**Rules**
- Preserve the existing cookie-based implementation.
- Return 401 for missing/expired/invalid session.
- Do not accept a Bearer token as an alternative unless the existing template already does so and the team explicitly changes the specification.

**Test:** existing auth middleware tests + integration tests.

## requirePaidAccess — `src/middleware/subscription.middleware.ts`

| Field | Detail |
|---|---|
| Signature | `requirePaidAccess(req, res, next)` |
| Purpose | Enforce the `+ Sub` gate used by paid-resource mutations. |
| Rules | Use the same `hasAccess` rule as EP-15: any subscription with future `currentPeriodEnd`. |
| Failure | 402 `"An active subscription is required"`. |
| Test | `tests/middleware/subscription.middleware.test.ts` |

## requireGitHubConnection — `src/middleware/github.middleware.ts`

| Field | Detail |
|---|---|
| Signature | `requireGitHubConnection(req, res, next)` |
| Purpose | Ensure a connection row exists before GitHub-dependent operations. |
| Failure | 403 with the exact message specified by Doc 5. |
| Important | A stored connection may still contain an invalid/revoked token. The GitHub service must handle that provider failure and delete the connection row as specified. |
| Test | `tests/middleware/github.middleware.test.ts` |

## requireStarterRepo — `src/middleware/github.middleware.ts`

| Field | Detail |
|---|---|
| Signature | `requireStarterRepo(req, res, next)` |
| Purpose | Enforce one starter repo before ticket operations requiring it. |
| Failure | 409 `"Create your starter repository before requesting a ticket"`. |
| Test | `tests/middleware/github.middleware.test.ts` |

## validate — existing `validate.middleware.ts`

**Purpose:** Validate request schemas and produce field-specific 400 errors.

**Rules**
- Use Zod schemas matching Doc 5.
- Do not duplicate validation logic in controllers.
- Server validation remains authoritative even when the frontend validates.

---

# 8.15 Serializers / Response Mapping

## serializeUser

Return only:
`id`, `name`, `email`, `role`, `emailVerifiedAt`, `createdAt`.

Never return:
`passwordHash`, refresh-token values, reset/verification tokens, OAuth access tokens.

## serializeSubscription

Return only:
`id`, `status`, `currentPeriodEnd`, `canceledAt`.

Never return Chapa subscription references.

## serializePayment

Return:
`id`, `amount`, `currency`, `status`, `paidAt`, `createdAt`.

Never return `chapaTxRef`.

## serializeRepo

Return:
`fullName`, `starterTemplate`, `defaultBranch`.

## serializeTicket

Flatten `Ticket.content` into the API Ticket object defined in Doc 5 while preserving:
`id`, `status`, `templateKey`, `title`, `scenario`, `category`, `difficulty`, `touchedFiles`, `acceptanceCriteria`, `testChecklist`, `branchName`, `repo`, timestamps.

## serializeSubmission

Return:
`id`, `attempt`, `status`, `prNumber`, `prUrl`, `headSha`, `ciPassed`, `ciRunUrl`, `failureReason`, `submittedAt`, `evaluation`, and `diff` only when `includeDiff=true`.

## serializeEvaluation

Attempt 1:
- feedback
- `scores: null`
- createdAt

Attempt 2:
- feedback
- all four category scores
- weighted total
- createdAt

---

# 8.16 Route-to-Function Traceability

| Endpoint | Primary controller function | Primary service function(s) |
|---|---|---|
| EP-01 | `register` | `registerUser`, `sendVerificationEmail` |
| EP-02 | `login` | `authenticateUser`, existing `createSession` |
| EP-03 | `refresh` | `refreshSession` |
| EP-04 | `logout` | `revokeCurrentSession` |
| EP-05 | `logoutAll` | `revokeAllSessions` |
| EP-06 | `verifyEmail` | `verifyEmail` |
| EP-07 | `resendVerification` | `resendVerificationEmail` |
| EP-08 | `forgotPassword` | `requestPasswordReset` |
| EP-09 | `resetPassword` | `resetPassword` |
| EP-10 | `changePassword` | `changePassword` |
| EP-11 | `getMe` | `getCurrentUser` |
| EP-12 | `updateMe` | `updateDisplayName` |
| EP-13 | `createCheckout` | `createCheckout` |
| EP-14 | `handleChapaWebhook` | signature verifier + `processChapaWebhook` |
| EP-15 | `getSubscription` | `getSubscriptionStatus` |
| EP-16 | `cancelSubscription` | `cancelSubscription` |
| EP-17 | `getPayments` | `listPayments` |
| EP-18 | `connect` | `createGitHubAuthorizeUrl` |
| EP-19 | `callback` | `handleGitHubCallback` |
| EP-20 | `getConnection` | `getGitHubConnection` |
| EP-21 | `disconnect` | `disconnectGitHub` |
| EP-22 | `createRepo` | `createStarterRepo` |
| EP-23 | `assignTicket` | `assignNextTicket` |
| EP-24 | `currentTicket` | `getCurrentTicket` |
| EP-25 | `getTicket` | `getTicketById` |
| EP-26 | `startTicket` | `startTicket` |
| EP-27 | `abandonTicket` | `abandonTicket` |
| EP-28 | `sendMessage` | `sendMentorMessage` |
| EP-29 | `getMessages` | mentor history query |
| EP-30 | `submit` | `submitWork` |
| EP-31 | `getSubmission` | `getSubmission` |
| EP-32 | `retry` | `retrySubmission` |
| EP-33 | `handleWorkflowRun` | signature verifier + `processWorkflowRunWebhook` |
| EP-34 | `getProfile` | `getExperienceProfile` |

---

# 8.17 Critical State-Transition Rules

These are implementation invariants, not optional controller behavior.

### Ticket

```text
assigned
  ├── start → in_progress
  └── abandon → abandoned

in_progress
  ├── submit → submitted_v1
  └── abandon → abandoned

submitted_v1
  ├── resubmit → resubmitted
  └── no abandon

resubmitted
  └── successful final evaluation → done

done
  └── no further submission
```

A ticket must never:
- move backward from `submitted_v1` to `in_progress`;
- move from `resubmitted` back to `in_progress`;
- become `done` from attempt 1;
- accept a third submission;
- be abandoned after a submission exists.

### Submission

```text
awaiting_ci → evaluating → completed
                         ↘ failed
awaiting_ci → failed
```

`failed` is a pipeline state, not a new attempt.

### Evaluation

- Attempt 1: feedback only, scores all null.
- Attempt 2: feedback + all four scores + weighted total.
- Score weights are immutable for V1: 40 / 25 / 20 / 15.

---

# 8.18 Transaction & Concurrency Rules

High-risk operations must explicitly consider concurrent requests.

1. **Registration:** rely on unique email constraint; translate unique conflict to 409.
2. **Refresh:** token rotation must prevent the same refresh token from being reused concurrently.
3. **Checkout:** concurrent checkout calls must not create multiple active subscriptions; DB constraints remain authoritative.
4. **Ticket assignment:** DR-01 is the final protection against two active tickets.
5. **Ticket start:** conditional state update prevents two start requests from both succeeding.
6. **Abandon:** conditional state update prevents abandon after submission.
7. **Submission:** attempt must be derived from the current ticket state inside the protected operation, not from a stale frontend state.
8. **Retry:** only a `failed` submission can transition back to processing.
9. **Webhook processing:** duplicate Chapa and GitHub events must be idempotent.
10. **Evaluation:** unique `Evaluation.submissionId` prevents duplicate evaluations for one submission.
11. **Final completion:** only attempt 2 may transition the ticket to `done`.

---

# 8.19 Logging & Security Rules

Every backend function must follow these rules unless a more specific rule above overrides it.

- Never log passwords.
- Never log raw access/refresh tokens.
- Never log raw verification/reset tokens.
- Never log encrypted GitHub token plaintext.
- Never log Chapa card/payment data.
- Do not include provider API keys in thrown errors.
- Include the existing request ID in operational error logs.
- Webhook logs must distinguish received, verified, rejected and processing-failed events.
- User-facing errors must use the exact API messages from Doc 5 where specified.
- Provider errors are normalized to 502 and must not expose provider internals.
- Ownership failures return 404.
- Database errors are not returned verbatim to clients.
- AI model output is untrusted input: validate it before persistence or use in state transitions.
- Diff, mentor messages, evaluator feedback and failure reasons are data, not executable HTML.

---

# 8.20 Configuration Boundaries

The following values must live in server configuration rather than being duplicated through service code:

- Database URL.
- JWT/access/refresh configuration already used by the existing auth implementation.
- Cookie settings already used by auth; verify `SameSite`/CSRF position before deployment.
- Chapa credentials and server-side price/currency.
- Chapa webhook secret.
- GitHub OAuth client credentials.
- GitHub requested scope.
- GitHub webhook secret.
- GitHub callback/frontend URLs.
- Gemini API key/model/configuration.
- Groq API key/model/configuration.
- Mentor maximum message length.
- Mentor per-ticket message limit/window.
- Verification-token expiration.
- Password-reset-token expiration.
- Submission CI/evaluator timeout.
- AI request timeouts.
- Any branch-name prefix convention.

If a value is unresolved in Docs 2/4/5, put it in configuration and mark the configuration key as pending team decision rather than hard-coding an arbitrary product value.

---

# 8.21 Implementation Order

The implementation AI should create backend work in this order so imports and tests remain incremental.

1. **Shared contracts/config**
   - enums/types for API/domain values
   - environment/config loader
   - `ApiError`/existing error middleware integration
   - validation schemas
   - serializers

2. **Database**
   - Prisma schema additions from Doc 4
   - additive migration
   - DR-01 to DR-04 hand-written SQL
   - supporting indexes DR-09/DR-10
   - verify existing `User`/`RefreshToken` definitions before migration

3. **Existing auth extension**
   - `User.name`
   - `emailVerifiedAt`
   - verification/reset token services
   - change-password/logout-all extensions
   - preserve existing login/refresh/logout behavior

4. **Email boundary**
   - verification
   - reset
   - payment-failure notification

5. **Subscription/Chapa boundary**
   - Chapa client adapter
   - checkout
   - subscription status/access
   - cancel
   - payment history
   - verified webhook

6. **GitHub boundary**
   - OAuth state
   - callback
   - encrypted connection
   - repo creation
   - branch/PR/diff reads

7. **Ticket generation**
   - template registry/files
   - isolated selection strategy
   - Gemini ticket generation
   - ticket assignment/start/abandon/current/detail

8. **Mentor**
   - transcript retrieval
   - hint-stage calculation
   - Gemini mentor adapter
   - rate limiting
   - send-message transaction

9. **Submission**
   - attempt derivation
   - PR/diff capture
   - submission state machine
   - polling response
   - retry

10. **Evaluation**
    - evaluator input
    - Groq adapter
    - rubric validation
    - weighted score
    - evaluation persistence

11. **GitHub workflow webhook**
    - raw-body signature verification
    - event matching
    - CI state update
    - evaluator dispatch
    - final ticket completion
    - timeout/failure handling

12. **Profile**
    - completed-ticket projection
    - final evaluation serialization

13. **Controllers/routes**
    - wire endpoints only after service behavior is tested
    - verify every EP-01–EP-34 against Doc 5

14. **Integration tests**
    - endpoint auth gates
    - ownership
    - state transitions
    - webhooks
    - provider failures
    - concurrency/idempotency cases

---

# 8.22 High-Scrutiny Completion Checklist

Before a backend function is considered complete, the implementation AI/verifier must confirm:

- [ ] Signature matches this document.
- [ ] Inputs are validated at the API boundary.
- [ ] Authorization is enforced server-side.
- [ ] Ownership is enforced for user-owned resources.
- [ ] Required subscription/GitHub/repo gates are enforced.
- [ ] Database constraints are relied upon where specified.
- [ ] State transitions are conditional and cannot skip required states.
- [ ] Duplicate requests/webhooks are safe.
- [ ] Provider failures become the documented 502 behavior.
- [ ] Sensitive values are never logged.
- [ ] AI output is validated before persistence/use.
- [ ] Transaction boundaries are explicit for multi-write operations.
- [ ] No raw payment/card data is persisted.
- [ ] No raw OAuth token is returned or logged.
- [ ] No third submission path exists.
- [ ] Attempt 1 never receives scores.
- [ ] Attempt 2 uses the fixed 40/25/20/15 rubric.
- [ ] Profile includes only completed tickets.
- [ ] Tests cover success, validation, authorization, ownership, wrong state, provider failure, concurrency/idempotency and boundary cases.
- [ ] Endpoint response matches Doc 5 exactly.
- [ ] No V2/V3 functionality has leaked into V1.

---

*This backend document is intentionally implementation-specific without inventing unresolved product decisions. Where Docs 2, 4 or 5 leave a behavior open, the implementation must isolate that behavior behind configuration or an integration boundary and leave the decision visible rather than silently choosing one.*

*Next: proceed to → [8. Function-Level Specification — Frontend]*
