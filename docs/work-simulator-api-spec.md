# 5. API Specification

Project: Work Simulator · Links back to: [4. Database Requirements & ER Diagram]

Every endpoint here traces back to a Use Case (placeholders from doc 2 until doc 3's IDs are available, see A-21) and forward to a controller file in [7. Folder & File Structure] (TBD until that doc exists).

Backend PR reviewers: use this doc, alongside the Team Guideline's PR checklist, to confirm the shipped endpoint matches what was specced.

**Decisions this doc is built on** (locked or confirmed with the team):
- Auth is httpOnly access + refresh cookies with rotation, as already built. It is not a Bearer token (the template's default) and is not redesigned here
- CI completion reaches the platform through a GitHub `workflow_run` webhook; the client polls the platform for submission status
- The platform creates the ticket's branch when the ticket is assigned. The user pushes to it and submits by ticket
- Access ends at `currentPeriodEnd`, whatever the subscription status (resolves Q-01 from doc 4; see 5.6)
- Two-pass flow: first submission = feedback only, resubmission = final score. The ticket state machine is exactly `assigned → in_progress → submitted_v1 → resubmitted → done`, plus `abandoned` (only before submission)
- Chapa is confirmed only by a verified webhook, never by the client redirect alone (FR-18, FR-19)
- Gemini is the mentor, Groq is the evaluator. The rubric is fixed at 40 / 25 / 20 / 15
- "Voxide" is still undefined, so no endpoint exists for it (FR-53)

**Source note:** only docs 2 and 4 were available. The request/response shapes for the already-built auth endpoints are assumed, not read from code (A-20). Verify them against the real router before this doc is treated as final.

---

## 5.1 Conventions (applies to all endpoints below)

**Base path:** `/api/v1` (template value, assumed to be the real one, A-19)

**Auth:** access and refresh tokens are httpOnly cookies, set by login and rotated by refresh. Browsers must send requests with credentials. Access levels used in the tables below:

| Level | Meaning | Failure |
|---|---|---|
| Public | No login needed | — |
| Required | Valid access-token cookie | 401 |
| + Sub | The user has an active paid period: a `Subscription` exists with `currentPeriodEnd` in the future, regardless of `status` (the same value as `hasAccess` in EP-15) | 402 |
| + GitHub | A `GitHubConnection` row exists for the user | 403 |
| + Repo | A `StarterRepo` row exists for the user | 409 |
| Webhook | No cookie. The request signature is verified instead | 401 |

**Envelope:** all JSON responses use `{ statusCode, success, message, data }`. Errors use the same envelope with `success: false` and `data: null`. Errors are thrown via `ApiError` and caught by `error.middleware.ts`. Validation failures come from `validate.middleware` with a field-specific message.

**Status codes used consistently** (the envelope has no machine-readable error code, so the frontend tells cases apart by status + message, A-19, A-23):

| Code | Used for |
|---|---|
| 400 | Validation failure or a malformed / invalid token |
| 401 | Missing, expired or invalid session only |
| 402 | Paid access required |
| 403 | GitHub is not connected, or the stored token is no longer valid, so the user must reconnect |
| 404 | Resource not found, or not owned by the caller (never reveals that another user's resource exists) |
| 409 | Wrong state or conflict |
| 410 | Verification or reset link expired or already used |
| 429 | Rate limited |
| 502 | Upstream failure (Chapa, GitHub, Gemini, Groq) |

**Rate limiting:** `authLimiter` already covers login (FR-12). The other public token endpoints (EP-07, EP-08) are assumed to reuse it (A-19).

**Non-JSON exceptions:** EP-19 (GitHub OAuth callback) responds with a redirect. EP-14 and EP-33 are webhooks called by Chapa and GitHub, not by the frontend.

**Subscription gate:** the "+ Sub" level applies to every action that spends paid resources or changes ticket state (EP-18, EP-22, EP-23, EP-26 – EP-30, EP-32). Read-only endpoints for the user's own data (tickets, history, profile, billing) stay available after a subscription lapses (A-22).

**Ownership:** any endpoint with `:ticketId` returns 404 if the ticket belongs to another user.

---

## 5.2 Endpoint Table (quick reference)

| ID | Method | Path | Auth | Linked Use Case | Linked FR |
|---|---|---|---|---|---|
| EP-01 | POST | /auth/register | Public | Register | FR-01, FR-02, FR-03, FR-05 |
| EP-02 | POST | /auth/login | Public | Login | FR-04, FR-12 |
| EP-03 | POST | /auth/refresh | Public (refresh cookie) | Login | FR-04 |
| EP-04 | POST | /auth/logout | Required | Logout | FR-10 |
| EP-05 | POST | /auth/logout-all | Required | Logout Everywhere | FR-11 |
| EP-06 | POST | /auth/verify-email | Public | Verify Email | FR-06 |
| EP-07 | POST | /auth/resend-verification | Public | Verify Email | FR-06 |
| EP-08 | POST | /auth/forgot-password | Public | Reset Password | FR-07 |
| EP-09 | POST | /auth/reset-password | Public | Reset Password | FR-07, FR-08 |
| EP-10 | POST | /auth/change-password | Required | Change Password | FR-09 |
| EP-11 | GET | /users/me | Required | Edit Profile | FR-13 |
| EP-12 | PATCH | /users/me | Required | Edit Profile | FR-13 |
| EP-13 | POST | /subscriptions/checkout | Required | Subscribe | FR-16, FR-17 |
| EP-14 | POST | /webhooks/chapa | Webhook | Subscribe, Payment Failed | FR-18, FR-19, FR-22 |
| EP-15 | GET | /subscriptions/me | Required | View Subscription | FR-20 |
| EP-16 | POST | /subscriptions/cancel | Required | Cancel Subscription | FR-21 |
| EP-17 | GET | /payments | Required | View Billing History | FR-23 |
| EP-18 | GET | /github/connect | Required + Sub | Connect GitHub | FR-25 |
| EP-19 | GET | /github/callback | Required (cookie) | Connect GitHub | FR-25 |
| EP-20 | GET | /github/connection | Required | Connect GitHub | FR-25, FR-26, FR-29 |
| EP-21 | DELETE | /github/connection | Required | Disconnect GitHub | FR-26 |
| EP-22 | POST | /github/repo | Required + Sub + GitHub | Start Project | FR-27, FR-28, FR-29 |
| EP-23 | POST | /tickets | Required + Sub + GitHub + Repo | Get Ticket | FR-15, FR-30, FR-31, FR-34 |
| EP-24 | GET | /tickets/current | Required | View Ticket | FR-32 |
| EP-25 | GET | /tickets/:ticketId | Required | View Ticket, View Past Ticket | FR-32, FR-36 |
| EP-26 | POST | /tickets/:ticketId/start | Required + Sub | Start Ticket | FR-33 |
| EP-27 | POST | /tickets/:ticketId/abandon | Required + Sub + GitHub + Repo | Abandon Ticket | FR-35 |
| EP-28 | POST | /tickets/:ticketId/mentor/messages | Required + Sub | Ask Mentor | FR-37, FR-38, FR-41 |
| EP-29 | GET | /tickets/:ticketId/mentor/messages | Required | View Mentor History | FR-39 |
| EP-30 | POST | /tickets/:ticketId/submissions | Required + Sub + GitHub + Repo | Submit Work, Revise & Resubmit | FR-42 – FR-46 |
| EP-31 | GET | /tickets/:ticketId/submissions/:attempt | Required | Get Feedback, Get Score | FR-36, FR-44, FR-47, FR-49 |
| EP-32 | POST | /tickets/:ticketId/submissions/:attempt/retry | Required + Sub | (edge case) | FR-49 |
| EP-33 | POST | /webhooks/github | Webhook | (system) | FR-43, FR-46, FR-48 |
| EP-34 | GET | /profile | Required | View Profile | FR-50, FR-51 |

`Linked Use Case` values are the descriptive placeholders from doc 2 (A-21).

---

## 5.3 Endpoint Detail

Timestamps are ISO 8601 UTC strings. IDs are UUID strings. Example values in JSON are placeholders.

### 5.3.0 Shared objects

**User**
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "string (value of the existing Role enum)",
  "emailVerifiedAt": "timestamp | null",
  "createdAt": "timestamp"
}
```

**Subscription**
```json
{
  "id": "uuid",
  "status": "active | past_due | canceled",
  "currentPeriodEnd": "timestamp",
  "canceledAt": "timestamp | null"
}
```

**Payment**
```json
{
  "id": "uuid",
  "amount": "string (decimal, e.g. \"499.00\")",
  "currency": "string",
  "status": "pending | succeeded | failed",
  "paidAt": "timestamp | null",
  "createdAt": "timestamp"
}
```

**Repo**
```json
{
  "fullName": "owner/name",
  "starterTemplate": "react | node_express",
  "defaultBranch": "string"
}
```

**Ticket.** `title` through `testChecklist` are the keys of `Ticket.content` in doc 4 (this defines the shape doc 4 deferred to this doc). Category, difficulty and touched files are copied from the template at assignment.
```json
{
  "id": "uuid",
  "status": "assigned | in_progress | submitted_v1 | resubmitted | done | abandoned",
  "templateKey": "string",
  "title": "string",
  "scenario": "string",
  "category": "string",
  "difficulty": "string",
  "touchedFiles": ["string"],
  "acceptanceCriteria": ["string"],
  "testChecklist": ["string"],
  "branchName": "string",
  "repo": { "fullName": "owner/name", "defaultBranch": "string" },
  "createdAt": "timestamp",
  "completedAt": "timestamp | null",
  "abandonedAt": "timestamp | null"
}
```

**Evaluation.** `scores` is `null` on attempt 1 (feedback only, FR-44) and filled on attempt 2 (FR-47). Category scores are 0–100; `total` is the weighted total (40 / 25 / 20 / 15).
```json
{
  "feedback": "string",
  "scores": {
    "requirementsMet": 0,
    "correctnessTests": 0,
    "codeQuality": 0,
    "problemSolving": 0,
    "total": 0
  },
  "createdAt": "timestamp"
}
```

**Submission.** `diff` is present only when requested (EP-31 `includeDiff=true`). `evaluation` is `null` until the submission is `completed`.
```json
{
  "id": "uuid",
  "attempt": 1,
  "status": "awaiting_ci | evaluating | completed | failed",
  "prNumber": 0,
  "prUrl": "string",
  "headSha": "string",
  "ciPassed": "boolean | null",
  "ciRunUrl": "string | null",
  "failureReason": "string | null",
  "submittedAt": "timestamp",
  "evaluation": "Evaluation | null",
  "diff": "string (only when requested)"
}
```

**MentorMessage**
```json
{
  "id": "uuid",
  "role": "user | mentor",
  "content": "string",
  "createdAt": "timestamp"
}
```

---

### 5.3.1 Authentication & Account

#### EP-01 · POST /auth/register

**Purpose:** Create an account and send a verification email. Already built; this doc adds `name` (new in doc 4). Does not log the user in.

**Request body:**
```json
{
  "name": "string, min 2 chars",
  "email": "string, valid email",
  "password": "string, min 8 chars"
}
```

**Success response — 201:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "User registered",
  "data": { "id": "uuid", "name": "string", "email": "string" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Password under 8 characters (FR-03) | "Password must be at least 8 characters" |
| 400 | Zod validation failure (missing/malformed field) | field-specific, from validate.middleware |
| 409 | Email already registered; no second account is created (FR-02) | "Email already in use" |

If sending the verification email fails, the account is still created and the user can use EP-07.

**Implemented in:** TBD (doc 7)

#### EP-02 · POST /auth/login

**Purpose:** Log in with email + password. Sets the access and refresh cookies. Already built.

**Request body:**
```json
{ "email": "string, valid email", "password": "string" }
```

**Success response — 200:** sets both cookies (httpOnly).
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Logged in",
  "data": { "user": "User" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Validation failure | field-specific |
| 401 | Wrong email or password | "Invalid email or password" |
| 429 | Too many failed attempts (`authLimiter`, FR-12) | as built |

Login does not check `emailVerifiedAt`. Whether anything is gated on verification is open (Q-04). The frontend can read `emailVerifiedAt` from `user`.

**Implemented in:** TBD (doc 7)

#### EP-03 · POST /auth/refresh

**Purpose:** Rotate the refresh token and issue a new access token. Uses the refresh cookie; no body. Already built.

**Success response — 200:** sets new cookies.
```json
{ "statusCode": 200, "success": true, "message": "Session refreshed", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 401 | Refresh token missing, expired, revoked or already rotated | "Invalid or expired session" |

**Implemented in:** TBD (doc 7)

#### EP-04 · POST /auth/logout

**Purpose:** Revoke the current refresh token and clear the cookies (FR-10). Already built. No body.

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Logged out", "data": null }
```

**Error responses:** 401 if there is no session.

**Implemented in:** TBD (doc 7)

#### EP-05 · POST /auth/logout-all

**Purpose:** Revoke every refresh token issued to the user (sets `revokedAt` on all active `RefreshToken` rows) and clear the cookies (FR-11). No body.

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Logged out of all devices", "data": null }
```

**Error responses:** 401 if there is no session.

**Implemented in:** TBD (doc 7)

#### EP-06 · POST /auth/verify-email

**Purpose:** Mark the account verified using the emailed link's token (FR-06).

**Request body:**
```json
{ "token": "string" }
```

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Email verified",
  "data": { "emailVerifiedAt": "timestamp" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Token unknown or malformed | "Invalid verification link" |
| 410 | Token past `expiresAt` | "This verification link has expired" |
| 410 | Token already used (`usedAt` set) | "This verification link has already been used" |

On either 410 the frontend offers to resend via EP-07 (FR-06).

**Implemented in:** TBD (doc 7)

#### EP-07 · POST /auth/resend-verification

**Purpose:** Send a new verification link. Always answers the same way, so it does not reveal whether an email has an account.

**Request body:**
```json
{ "email": "string, valid email" }
```

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "If an unverified account exists for this email, a new verification link has been sent",
  "data": null
}
```

**Error responses:** 400 validation failure; 429 rate limited.

**Implemented in:** TBD (doc 7)

#### EP-08 · POST /auth/forgot-password

**Purpose:** Send a password reset link (FR-07). The link expires after a fixed window, e.g. 1 hour. Always answers the same way.

**Request body:**
```json
{ "email": "string, valid email" }
```

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "If an account exists for this email, a reset link has been sent",
  "data": null
}
```

**Error responses:** 400 validation failure; 429 rate limited.

**Implemented in:** TBD (doc 7)

#### EP-09 · POST /auth/reset-password

**Purpose:** Set a new password using a reset token. A used or expired token is rejected and the password does not change (FR-08).

**Request body:**
```json
{ "token": "string", "newPassword": "string, min 8 chars" }
```

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Password reset", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Token unknown or malformed | "Invalid reset link" |
| 400 | Validation failure (e.g. password under 8 characters) | field-specific |
| 410 | Token expired | "This reset link has expired" |
| 410 | Token already used | "This reset link has already been used" |

Whether a successful reset also revokes existing sessions is open (Q-11).

**Implemented in:** TBD (doc 7)

#### EP-10 · POST /auth/change-password

**Purpose:** Change password while logged in, after confirming the current one (FR-09).

**Request body:**
```json
{ "currentPassword": "string", "newPassword": "string, min 8 chars" }
```

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Password changed", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Current password wrong | "Current password is incorrect" |
| 400 | Validation failure | field-specific |
| 401 | No session | as built |

The wrong-password case is 400, not 401, so the frontend does not mistake it for an expired session.

**Implemented in:** TBD (doc 7)

#### EP-11 · GET /users/me

**Purpose:** Return the logged-in user (FR-13).

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Current user",
  "data": { "user": "User" }
}
```

**Error responses:** 401 if there is no session.

**Implemented in:** TBD (doc 7)

#### EP-12 · PATCH /users/me

**Purpose:** Update the display name (FR-13). Email and password are not changed here.

**Request body:**
```json
{ "name": "string, min 2 chars" }
```

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated",
  "data": { "user": "User" }
}
```

**Error responses:** 400 validation failure; 401 no session.

**Implemented in:** TBD (doc 7)

---

### 5.3.2 Payment & Subscription (Chapa)

#### EP-13 · POST /subscriptions/checkout

**Purpose:** Start a subscription. Creates a `Payment` with status `pending`, asks Chapa for a hosted checkout and returns its URL (FR-16). Price and currency come from server configuration, never from the request. No card data touches the platform (FR-17).

The `return_url` given to Chapa is a frontend page (defined in doc 6). That page only polls EP-15. Reaching it does not activate anything (FR-18).

**Request body:** none.

**Success response — 201:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Checkout created",
  "data": { "checkoutUrl": "string" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 409 | User already has a subscription in `active` or `past_due` (DR-02) | "You already have an active subscription" |
| 502 | Chapa checkout creation failed | "Could not start checkout with Chapa, please try again" |

**Implemented in:** TBD (doc 7)

#### EP-14 · POST /webhooks/chapa

**Purpose:** Receive Chapa's payment events. This is the only thing that activates a subscription (FR-18). Called by Chapa, not the frontend.

**Verification:** the request signature is checked against the raw request body with the Chapa webhook secret. The header name and algorithm come from Chapa's webhook docs and must be confirmed during implementation. This route must receive the raw body, so its parser is set up before the JSON parser (FR-19).

**Request body:** Chapa's payload. This doc only requires the transaction reference (matched to `Payment.chapaTxRef`) and the payment outcome.

**Behavior:**
- Payment succeeded and the `Payment` is `pending`: set the payment to `succeeded` with `paidAt`. If the user has no current subscription, create one with `status = active`; set `currentPeriodEnd` to one month after `paidAt` (A-30).
- Payment failed: set the payment to `failed`. If it belonged to an existing subscription, set the subscription to `past_due` and send the failure email (FR-22).
- Repeated event for a payment already `succeeded` or `failed`: no change, still answers 200 (DR-06).
- Unknown transaction reference: logged as a warning, answers 200 so Chapa does not keep retrying.
- Every event is logged as received, verified or rejected, separately from normal request logs (doc 2, 2.2).

How Chapa triggers monthly renewals, and whether it sends a subscription-level reference, is still open (Q-05), so the renewal path of this handler is not final.

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Webhook processed", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 401 | Signature missing or invalid (FR-19). Nothing is changed | "Invalid webhook signature" |
| 400 | Payload malformed | "Invalid webhook payload" |

**Implemented in:** TBD (doc 7)

#### EP-15 · GET /subscriptions/me

**Purpose:** Current subscription status and next billing date (FR-20). Also what the checkout return page polls, for a limited time, until the webhook has created the subscription (A-30).

`subscription` is the user's most recent subscription, or `null` if they never had one. `hasAccess` is `true` when any subscription has `currentPeriodEnd` in the future.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Subscription status",
  "data": { "subscription": "Subscription | null", "hasAccess": true }
}
```

**Error responses:** 401 no session.

**Implemented in:** TBD (doc 7)

#### EP-16 · POST /subscriptions/cancel

**Purpose:** Cancel the subscription (FR-21). Status becomes `canceled` immediately and `canceledAt` is set. Access continues until `currentPeriodEnd`, then ends. Also stops future charges at Chapa; the mechanism depends on Q-05. No body.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Subscription canceled",
  "data": { "subscription": "Subscription" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 409 | No subscription in `active` or `past_due` | "No active subscription to cancel" |
| 502 | Chapa could not be told to stop future charges | "Could not cancel with Chapa, please try again" |

**Implemented in:** TBD (doc 7)

#### EP-17 · GET /payments

**Purpose:** Payment history (FR-23), newest first. No pagination in V1 (doc 2, 2.3). The Chapa reference is not exposed.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment history",
  "data": { "payments": ["Payment"] }
}
```

**Error responses:** 401 no session.

**Implemented in:** TBD (doc 7)

---

### 5.3.3 GitHub Connection & Repo Setup

#### EP-18 · GET /github/connect

**Purpose:** Return the GitHub OAuth authorize URL (FR-25). The frontend navigates to it. The URL carries a `state` value that is signed, short-lived and bound to the user (A-19; no table for it in doc 4). The requested scope is limited to repo creation + push (exact value: see Q-08).

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "GitHub authorization URL",
  "data": { "authorizeUrl": "string" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 402 | No paid access | "An active subscription is required" |

**Implemented in:** TBD (doc 7)

#### EP-19 · GET /github/callback

**Purpose:** GitHub redirects the browser here after the user approves. Not JSON.

**Query:** `code`, `state` (both from GitHub).

**Behavior:** validate `state` against the logged-in user; exchange `code` for a token; check the granted scope is not broader than the requested one (FR-25); store the token encrypted; create or replace the user's `GitHubConnection`. Then redirect (302) to a frontend page (defined in doc 6) with `?github=connected`.

**Failure:** always a redirect, never JSON, to the same frontend page with `?github=error&reason=<value>`, where `reason` is one of `state_invalid`, `scope_invalid`, `exchange_failed`.

This relies on the browser sending the login cookie on this cross-site redirect, which depends on the built cookie's `SameSite` setting (Q-12).

**Implemented in:** TBD (doc 7)

#### EP-20 · GET /github/connection

**Purpose:** Whether GitHub is connected, and the repo if one exists (FR-25, FR-26, FR-29).

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "GitHub connection",
  "data": {
    "connected": true,
    "githubLogin": "string | null",
    "repo": "Repo | null"
  }
}
```

`githubLogin` is `null` when not connected. `repo` is `null` until EP-22 has run, and it stays visible after a disconnect because the repo record survives (A-07).

**Error responses:** 401 no session.

**Implemented in:** TBD (doc 7)

#### EP-21 · DELETE /github/connection

**Purpose:** Disconnect GitHub (FR-26). Deletes the `GitHubConnection` row (A-07). Repo and submission records are kept. Does not revoke the grant at GitHub (A-32). While disconnected, EP-22, EP-23, EP-27 and EP-30 answer 403.

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "GitHub disconnected", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 404 | Not connected | "GitHub is not connected" |

**Implemented in:** TBD (doc 7)

#### EP-22 · POST /github/repo

**Purpose:** Create the user's single repo from a starter template in their GitHub account (FR-27). One repo per user. Django is not accepted (unconfirmed).

**Request body:**
```json
{
  "starterTemplate": "react | node_express",
  "repoName": "string, optional, default \"work-simulator\""
}
```

**Success response — 201:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Repository created",
  "data": { "repo": "Repo" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Validation failure (e.g. unsupported template) | field-specific |
| 402 | No paid access | "An active subscription is required" |
| 403 | GitHub not connected | "GitHub is not connected. Connect GitHub to continue" |
| 403 | GitHub rejected the stored token (the connection row is deleted, FR-29) | "Your GitHub connection is no longer valid. Reconnect GitHub to continue" |
| 409 | User already has a repo | "You already have a starter repository" |
| 409 | A repo with that name already exists in the user's GitHub account (FR-28) | "A repository named '<repoName>' already exists in your GitHub account. Choose another name or delete it, then try again" |
| 502 | GitHub API error (FR-28) | "GitHub could not create the repository, please try again" |

**Implemented in:** TBD (doc 7)

---

### 5.3.4 Ticket Lifecycle

#### EP-23 · POST /tickets

**Purpose:** Assign the user's next ticket (FR-30). Only one active ticket exists at a time (DR-01).

**Behavior:**
1. The server picks a ticket template (selection rule: Q-09).
2. Gemini fills in the specific wording inside the template's fixed structure (FR-31).
3. The platform creates the ticket's branch in the user's repo from `defaultBranch`.
4. The `Ticket` row is created with status `assigned`. It is created only if both earlier steps succeeded.

**Request body:** none.

**Success response — 201:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Ticket assigned",
  "data": { "ticket": "Ticket" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 402 | No paid access (FR-15) | "An active subscription is required" |
| 403 | GitHub not connected, or the token is no longer valid | as EP-22 |
| 409 | No repo yet | "Create your starter repository before requesting a ticket" |
| 409 | User already has an active ticket (FR-34) | "You already have an active ticket" |
| 502 | Ticket wording generation failed | "Could not generate a ticket, please try again" |
| 502 | Branch creation failed | "Could not create the ticket branch on GitHub, please try again" |

**Implemented in:** TBD (doc 7)

#### EP-24 · GET /tickets/current

**Purpose:** The user's active ticket, with its acceptance criteria and test checklist (FR-32). Active means any status except `done` and `abandoned`.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Current ticket",
  "data": { "ticket": "Ticket | null" }
}
```

`ticket` is `null` when there is no active ticket.

**Error responses:** 401 no session.

**Implemented in:** TBD (doc 7)

#### EP-25 · GET /tickets/:ticketId

**Purpose:** One ticket with a summary of each submission, for viewing a past ticket (FR-32, FR-36). Works for `done` and `abandoned` tickets too. The diff is not included here; use EP-31.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Ticket",
  "data": { "ticket": "Ticket", "submissions": ["Submission (without diff)"] }
}
```

`submissions` holds 0–2 items ordered by `attempt`.

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 404 | Not found, or not owned by the caller | "Ticket not found" |

**Implemented in:** TBD (doc 7)

#### EP-26 · POST /tickets/:ticketId/start

**Purpose:** Move the ticket from `assigned` to `in_progress` when the user starts working (FR-33, A-25). The user sees the acceptance criteria before this step (FR-32). No body.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Ticket started",
  "data": { "ticket": "Ticket" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 402 | No paid access | "An active subscription is required" |
| 404 | Not found, or not owned | "Ticket not found" |
| 409 | Ticket is not `assigned` | "This ticket has already been started" |

**Implemented in:** TBD (doc 7)

#### EP-27 · POST /tickets/:ticketId/abandon

**Purpose:** Abandon the ticket and immediately issue a new one (FR-35). Only possible while the ticket is `assigned` or `in_progress` (before any submission). The abandoned row and its mentor history are kept, and its branch stays in the user's repo (A-31). No body.

If the abandon succeeds but issuing the new ticket fails (any of the failures in EP-23), the abandon stands and `newTicket` is `null`. The user can call EP-23.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Ticket abandoned",
  "data": { "abandonedTicketId": "uuid", "newTicket": "Ticket | null" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 402 | No paid access | "An active subscription is required" |
| 403 | GitHub not connected, or the token is no longer valid | as EP-22 |
| 404 | Not found, or not owned | "Ticket not found" |
| 409 | Ticket is past `in_progress` | "A ticket cannot be abandoned after it has been submitted" |

**Implemented in:** TBD (doc 7)

---

### 5.3.5 AI Mentor

#### EP-28 · POST /tickets/:ticketId/mentor/messages

**Purpose:** Send a message to the Gemini mentor about this ticket (FR-37). The mentor follows progressive hints and never opens with a direct solution (FR-38). The hint stage is worked out on the server from the stored transcript. The client cannot request a hint level.

The response is a single JSON reply, not a stream (A-29). Both messages are stored together after the mentor replies, so a failed AI call leaves nothing behind and a retry does not duplicate the user's message.

**Request body:**
```json
{ "content": "string, 1 to N chars (N set at implementation, Q-10)" }
```

**Success response — 201:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Mentor replied",
  "data": { "userMessage": "MentorMessage", "mentorMessage": "MentorMessage" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | Validation failure (empty or too long) | field-specific |
| 402 | No paid access | "An active subscription is required" |
| 404 | Not found, or not owned | "Ticket not found" |
| 409 | Ticket is not `in_progress` (FR-37) | "The mentor is only available while the ticket is in progress" |
| 429 | Per-ticket mentor message limit reached (FR-41) | "Mentor message limit reached for this ticket" |
| 502 | Mentor call failed | "The mentor is unavailable, please try again" |

The 409 rule follows FR-37 literally, which also blocks the mentor during the revision phase (`submitted_v1`). See Q-10.

**Implemented in:** TBD (doc 7)

#### EP-29 · GET /tickets/:ticketId/mentor/messages

**Purpose:** The full mentor conversation for a ticket, oldest first (FR-39). Available for any ticket status, including `done` and `abandoned`.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Mentor history",
  "data": { "messages": ["MentorMessage"] }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 404 | Not found, or not owned | "Ticket not found" |

**Implemented in:** TBD (doc 7)

---

### 5.3.6 Submission & Evaluation

#### EP-30 · POST /tickets/:ticketId/submissions

**Purpose:** Submit the work pushed to the ticket's branch (FR-42). Used for both passes. The attempt is decided by ticket state: `in_progress` → attempt 1, `submitted_v1` → attempt 2 (resubmission, FR-45). The pass is never chosen by the client.

**Behavior:**
1. The server reads the ticket's branch from GitHub. It reuses the open PR for that branch, or opens one from the branch into `defaultBranch` if none exists. Attempt 2 reuses the same PR (A-27).
2. It records the head commit and the PR diff.
3. It creates the `Submission` (`awaiting_ci`) and moves the ticket to `submitted_v1` (attempt 1) or `resubmitted` (attempt 2) in the same step (A-26).
4. It checks whether GitHub Actions has already finished for that commit. If not, the result arrives through EP-33 (A-28).

**Request body:** none.

**Success response — 202:**
```json
{
  "statusCode": 202,
  "success": true,
  "message": "Submission received",
  "data": { "submission": "Submission" }
}
```

The client then polls EP-31 until `status` is `completed` or `failed`.

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 400 | No commits on the ticket branch beyond `defaultBranch` | "No commits found on branch '<branchName>'. Push your work before submitting" |
| 402 | No paid access | "An active subscription is required" |
| 403 | GitHub not connected, or the token is no longer valid | as EP-22 |
| 404 | Not found, or not owned | "Ticket not found" |
| 409 | Ticket is not `in_progress` or `submitted_v1` | "This ticket cannot be submitted in its current state" |
| 409 | Attempt 2 requested while attempt 1 is still processing or failed | "Wait for feedback on your first submission before resubmitting" |
| 502 | GitHub could not be read | "Could not read your pull request from GitHub, please try again" |

**Implemented in:** TBD (doc 7)

#### EP-31 · GET /tickets/:ticketId/submissions/:attempt

**Purpose:** Status and result of one submission pass. This is the polling endpoint while a submission is processing, and the detail view for feedback, score and diff afterwards (FR-36, FR-44, FR-47, FR-49). `:attempt` is `1` or `2`.

**Query:** `includeDiff` (boolean, default `false`). Leave it off while polling, since the diff can be large.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Submission",
  "data": { "submission": "Submission" }
}
```

What the client shows by `status`:
- `awaiting_ci` or `evaluating`: still working, keep polling.
- `completed`: `evaluation` is present. On attempt 1 `evaluation.scores` is `null`. On attempt 2 it holds all four category scores and the total (FR-47).
- `failed`: `failureReason` is set and the user can retry via EP-32. The submission is not lost (FR-49).

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 404 | Ticket or submission not found, or not owned | "Submission not found" |

**Implemented in:** TBD (doc 7)

#### EP-32 · POST /tickets/:ticketId/submissions/:attempt/retry

**Purpose:** Re-run the pipeline (CI check and evaluator) for a submission whose status is `failed` (FR-49). It re-runs the same submission. It is not a new attempt and does not count as one of the two passes (A-12). No body.

**Success response — 202:**
```json
{
  "statusCode": 202,
  "success": true,
  "message": "Retry started",
  "data": { "submission": "Submission" }
}
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 402 | No paid access | "An active subscription is required" |
| 404 | Not found, or not owned | "Submission not found" |
| 409 | Submission is not `failed` | "Only a failed submission can be retried" |

**Implemented in:** TBD (doc 7)

#### EP-33 · POST /webhooks/github

**Purpose:** Receive GitHub's `workflow_run` events so the platform learns when a submission's Actions run has finished (FR-43). Called by GitHub, not the frontend.

**Verification:** the `X-Hub-Signature-256` header is checked against the raw body with the GitHub webhook secret. The event type comes from `X-GitHub-Event`. Events other than a completed `workflow_run` (including `ping`) are acknowledged and ignored.

**Behavior** (acknowledged immediately; the rest continues after the response, A-33):
1. Match the event to a `Submission` by repo full name and head commit. Events with no matching submission are ignored.
2. Set `ciPassed`: `true` for a `success` conclusion, `false` for `failure`. Any other conclusion (e.g. cancelled, timed out) marks the submission `failed` with a `failureReason`, so the user sees the retry state (FR-49).
3. Set the submission to `evaluating`. Groq reads the diff and the pass/fail result, never the diff alone (FR-43). On attempt 2 it also reads the mentor transcript for the problem-solving category (FR-40).
4. Save the `Evaluation` and set the submission to `completed`. Attempt 1 stores feedback only (FR-44). Attempt 2 stores feedback and scores (FR-46). If the evaluator call fails, the submission becomes `failed`.
5. On a completed attempt 2, the ticket moves to `done` and `completedAt` is set (FR-48).

**Success response — 200:**
```json
{ "statusCode": 200, "success": true, "message": "Webhook received", "data": null }
```

**Error responses:**

| Status | Condition | Message |
|---|---|---|
| 401 | Signature missing or invalid. Nothing is changed | "Invalid webhook signature" |

How this webhook gets attached to each user's repo is not settled (Q-08).

**Implemented in:** TBD (doc 7)

---

### 5.3.7 Experience Profile

#### EP-34 · GET /profile

**Purpose:** The user's practice work-sample record: every `done` ticket, newest first (FR-50). Abandoned tickets are not listed. The frontend labels this as a practice record, not a certified credential (FR-51); that label is UI text and is not part of this response. Each item has the final score and feedback. The diff and the attempt-1 feedback are reached through EP-25 and EP-31.

**Success response — 200:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile",
  "data": {
    "items": [
      {
        "ticketId": "uuid",
        "title": "string",
        "category": "string",
        "difficulty": "string",
        "completedAt": "timestamp",
        "evaluation": "Evaluation (attempt 2, scores filled)"
      }
    ]
  }
}
```

**Error responses:** 401 no session.

**Implemented in:** TBD (doc 7)

---

## 5.4 Assumptions

Numbering continues from doc 4 (A-01 to A-18). Correct any that are wrong before doc 6 is written.

| ID | Assumption | Where it matters |
|---|---|---|
| A-19 | The template's conventions are the project's real ones: base path `/api/v1`, the `{ statusCode, success, message, data }` envelope, `ApiError`, `error.middleware.ts`, `validate.middleware`. Errors use the same envelope with `success: false` and `data: null`. There is no machine-readable error code, so the frontend uses status + message. Public token endpoints reuse `authLimiter`. The OAuth `state` is signed and short-lived (no table in doc 4) | 5.1 |
| A-20 | Cookie auth is as built, not Bearer. The built endpoints are assumed to be `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, with the request/response shapes above. Their exact paths, messages and cookie details need checking against the router | EP-01 – EP-04 |
| A-21 | Use case links use doc 2's placeholder names because doc 3 was not available. "Implemented in" is TBD until doc 7 | 5.2, all endpoints |
| A-22 | The "+ Sub" gate applies to GitHub connect, repo creation, ticket assign/start/abandon, mentor, submit and retry. Read-only endpoints for the user's own data stay open after a lapse. FR-15 only says a subscription is needed "before being assigned their first ticket", so gating the rest is an extension | 5.1 |
| A-23 | Status code meanings are fixed in 5.1: 402 = paid access needed, 403 = GitHub reconnect needed, 401 only for session problems, 410 = expired/used link | 5.1 |
| A-24 | The repo name is optional in EP-22 and defaults to `work-simulator`. A name collision returns a 409 telling the user to choose another name (FR-28) | EP-22 |
| A-25 | `assigned → in_progress` happens through an explicit start endpoint. Doc 2 does not say what triggers it | EP-26 |
| A-26 | The ticket moves to `submitted_v1` or `resubmitted` when the submission is created, not when feedback arrives. Doc 2's "(feedback given)" note is read as `Submission.status = completed`. This matches "abandon only before submission" | EP-30 |
| A-27 | The platform opens the PR at first submission if none exists for the ticket branch, and reuses an existing open one. Attempt 2 reuses the same PR and branch | EP-30 |
| A-28 | CI results arrive through the GitHub webhook. Because CI may finish before the user submits, EP-30 also checks for an already-finished run on that commit. Events for commits with no submission are ignored | EP-30, EP-33 |
| A-29 | The mentor reply is one JSON response, not a stream. Nothing is stored if the AI call fails. Hint stage is derived from the stored transcript | EP-28 |
| A-30 | Price and currency are server configuration. The checkout return page polls EP-15 for a limited time. The first successful payment creates the subscription with `currentPeriodEnd` = one month after `paidAt`, and renewals extend it by one month | EP-13 – EP-15 |
| A-31 | Abandoning keeps the abandoned ticket row, its mentor history and its branch. If issuing the new ticket fails, the abandon still stands | EP-27 |
| A-32 | Disconnecting GitHub does not revoke the OAuth grant at GitHub | EP-21 |
| A-33 | Webhook work continues in the same server process after the response is sent. A submission stuck in `awaiting_ci` or `evaluating` past a timeout is marked `failed` so the user sees the retry state (timeout values: Q-13) | EP-33 |
| A-34 | The evaluator (Groq) produces the attempt-1 feedback as well as the attempt-2 score. Doc 2 says who scores but not who writes the first feedback | EP-33 |

---

## 5.5 Open Questions

Numbering continues from doc 4 (Q-01 to Q-06). Q-03 to Q-06 from doc 4 are still open. Q-01 and Q-02 are resolved (see 5.6).

| ID | Question | Affects |
|---|---|---|
| Q-07 | **Failed renewals get no grace period as specced.** Access ends at `currentPeriodEnd`, but a renewal charge normally fails at or after that moment, so `past_due` effectively means no access, with only the failure email as the difference from a hard cut. Is that intended, or should FR-22 have a grace period (how many days)? | EP-14, EP-15, "+ Sub" |
| Q-08 | **How does the `workflow_run` webhook get attached to each user's repo, and with which OAuth scope?** Registering a webhook on the user's repo needs a token permission that may go beyond the "repo create + push only" scope in FR-25. Which exact scope string does the team request? Check both against each other before building EP-18 and EP-33 | EP-18, EP-19, EP-33, FR-25 |
| Q-09 | Which template does a user get next? Doc 2 says templates are team-authored but not how one is chosen (order, random, difficulty ladder) | EP-23 |
| Q-10 | (a) How many mentor messages per ticket, and over what window (FR-41)? (b) Maximum length of a message? (c) Should the mentor stay available during the revision phase (`submitted_v1`)? FR-37 says `in_progress` only, which blocks it during revision | EP-28 |
| Q-11 | Does a password reset or change revoke existing refresh tokens (log out other sessions)? | EP-09, EP-10 |
| Q-12 | What are the built cookies' `SameSite` and related settings? The OAuth callback needs the cookie on a redirect from GitHub, and cookie-authenticated POSTs need a CSRF position. Neither is defined in the attached docs | EP-19, all cookie-authenticated POSTs |
| Q-13 | What timeouts mark a submission `failed` while waiting for CI or the evaluator? Doc 2 gives ~30 s p95 for the evaluator only | EP-33, FR-49 |

---

## 5.6 Changes to Earlier Docs

Numbering is not changed. These are amendments.

**Doc 4:**
- **Q-01 resolved.** Access rule A-15 becomes: a user has paid access when any `Subscription` has `currentPeriodEnd` in the future, whatever its status. This replaces the "active, or canceled with time left" wording, which left `past_due` undefined. See Q-07 for the consequence.
- **Q-02 resolved.** The platform creates the branch at assignment, so `Ticket.branchName` is always set. It can change from nullable to required. There are no rows yet, so this costs nothing.
- **A-10.** The shape of `Ticket.content` is now defined by the Ticket object in 5.3.0.

**Doc 2:**
- **FR-25.** Its scope limit needs to be checked against how the webhook is attached (Q-08).
- **FR-33 / A-26.** Clarification: the ticket becomes `submitted_v1` or `resubmitted` when the submission is created. "Feedback given" is tracked by `Submission.status`.
- **FR-37.** Applied literally in EP-28 (mentor blocked in `submitted_v1`). See Q-10.

---

*Numbering convention: FR-01, FR-02... (doc 2), `UC-##` (doc 3), `DR-##`, `A-##` and `Q-##` (docs 4 and 5) and `EP-##` (this doc) each form one continuous sequence across the whole series. Never renumber once used. If an endpoint is dropped, mark it `~~EP-XX~~ (deprecated, see EP-YY)` instead.*

Next: proceed to → [6. Frontend UI, Pages & Components]
