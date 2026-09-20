# 2. Functional & Non-Functional Requirements

Project: Work Simulator · Links back to: [1. Problem & Solution — V1/V2/V3](./work-simulator-problem-solution-v2.md)

**Decisions this doc is built on** (confirmed with the team):
- Auth: email + password account, GitHub connected separately for repo access (not GitHub-OAuth-only)
- Payment: real V1 feature — Chapa, monthly recurring subscription
- AI split: Gemini for the mentor, Groq (fast open-model inference) for the evaluator
- Ticket-content generation model: **assumed Gemini** (same as mentor, since both are generative rather than evaluative) — not explicitly confirmed, flag if wrong
- "Voxide": still unresolved after two asks — marked `TBD` below as its own open requirement rather than guessed at
- Defaults not pushed back on: fully synchronous ticket flow (no async product notifications — separate from transactional email, see FR-05 to FR-08), no user-uploaded profile content, no admin panel, account deletion deferred to V2

A note on `Linked Use Case`: [3. Use Cases] hasn't been written yet, so this column uses short descriptive placeholders instead of fake `UC-##` numbers — replace them with real IDs once that doc exists, rather than inventing numbers now that would need renumbering later (see the numbering convention note at the bottom).

---

## 2.1 Functional Requirements

Each requirement is written to be independently testable — if a row can't be turned into a test case as written, it needs to be split or made more specific.

### 2.1.1 Authentication & Account

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-01 | A user can register with name, email, and password | Must | Register |
| FR-02 | Registering with an email that already has an account returns a 409 error and does not create a second account | Must | Register |
| FR-03 | Passwords under 8 characters are rejected at registration with a 400 and a specific message (not a generic "invalid input") | Must | Register |
| FR-04 | A user can log in with email + password; both access and refresh tokens are set as httpOnly cookies (already built) | Must | Login |
| FR-05 | A newly registered account receives a verification email | Must | Verify Email |
| FR-06 | Clicking the verification link marks the account verified; an expired or already-used verification link shows a clear "expired/used" message and offers to resend | Must | Verify Email |
| FR-07 | A user can request a password reset by email; the reset link expires after a fixed window (e.g. 1 hour) | Must | Reset Password |
| FR-08 | A used or expired password-reset link is rejected and does not reset the password (one-time-token reuse must fail) | Must | Reset Password |
| FR-09 | A logged-in user can change their password, providing the current password first | Should | Change Password |
| FR-10 | A logged-in user can log out; this revokes their current refresh token (already built) | Must | Logout |
| FR-11 | A logged-in user can "log out of all devices," revoking every refresh token issued to their account | Should | Logout Everywhere |
| FR-12 | Repeated failed login attempts on one account are rate-limited (already built via `authLimiter`) | Must | Login |
| FR-13 | A user can view and update their display name | Should | Edit Profile |
| FR-14 | Account deletion / deactivation | **Out of scope for V1** — see 2.3 | — |

### 2.1.2 Payment & Subscription (Chapa)

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-15 | A user must have an active subscription before being assigned their first ticket | Must | Subscribe |
| FR-16 | A user can start a subscription; they're redirected to Chapa's hosted checkout, not a custom card form | Must | Subscribe |
| FR-17 | The platform never stores raw card/payment details — only the Chapa transaction/subscription reference | Must | Subscribe |
| FR-18 | Subscription status is confirmed via a Chapa webhook, not just the client-side checkout redirect — a user cannot mark themselves subscribed by hitting a success URL without the webhook also confirming it | Must | Subscribe |
| FR-19 | The webhook endpoint verifies Chapa's signature and rejects unsigned/invalid requests | Must | Subscribe |
| FR-20 | A user can view their current subscription status (active / past due / canceled) and next billing date | Must | View Subscription |
| FR-21 | A user can cancel their subscription; access continues until the current paid period ends, then is revoked | Must | Cancel Subscription |
| FR-22 | A failed recurring payment moves the subscription to "past due" and notifies the user (email — see transactional email, FR-05) rather than silently cutting access immediately | Should | Payment Failed |
| FR-23 | A user can view their payment history (dates, amounts, status) | Should | View Billing History |
| FR-24 | Refunds are handled manually via the Chapa dashboard for V1, not a self-service in-app flow | **Out of scope for V1** — see 2.3 | — |

### 2.1.3 GitHub Connection & Repo Setup

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-25 | A logged-in, subscribed user can connect their GitHub account via OAuth, scoped to repo creation + push only (not full account access — already decided) | Must | Connect GitHub |
| FR-26 | A user can disconnect their GitHub account; doing so does not delete past submissions, but blocks starting a new ticket until reconnected | Should | Disconnect GitHub |
| FR-27 | On starting their first ticket, the user picks a starter template (React or Node/Express for V1 — see the problem/solution doc, 1.4.3) and a repo is created in their GitHub account from that template | Must | Start Project |
| FR-28 | If repo creation fails (name collision, GitHub API error, revoked token), the user sees a specific, actionable error — not a generic failure screen | Must | Start Project |
| FR-29 | If the user's GitHub token is revoked or expired mid-session, the next GitHub-dependent action prompts a reconnect rather than failing silently | Should | (edge case) |

### 2.1.4 Ticket Lifecycle

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-30 | A subscribed user with a connected repo is assigned exactly one active ticket at a time | Must | Get Ticket |
| FR-31 | A ticket's structure (category, difficulty, touched files, acceptance criteria, test checklist) comes from a team-authored template; the AI (Gemini — see note on ticket-content generation) fills in the specific wording/scenario within that structure, never inventing the structure itself | Must | Get Ticket |
| FR-32 | A ticket displays its acceptance criteria and test checklist to the user before they start working | Must | View Ticket |
| FR-33 | A ticket moves through a fixed state machine: `assigned → in_progress → submitted_v1 (feedback given) → resubmitted → scored → done` | Must | (system) |
| FR-34 | A user cannot be assigned a new ticket while their current one is not in the `done` state | Must | Get Ticket |
| FR-35 | A user can abandon their current ticket, which resets it and immediately issues a new one — used as a safety valve if a ticket is broken or the user is stuck for good reason | Should | Abandon Ticket |
| FR-36 | A completed (`done`) ticket, its diff, feedback, and score are retained and viewable afterward (feeds the experience profile, 2.1.7) | Must | View Past Ticket |

### 2.1.5 AI Mentor

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-37 | While a ticket is `in_progress`, a user can message the AI mentor (Gemini) about that specific ticket | Must | Ask Mentor |
| FR-38 | The mentor follows progressive hints: it asks what the user has tried, then gives a conceptual hint, then points at a relevant file/function, and only gives a more specific suggestion if asked again — it does not open with a direct solution | Must | Ask Mentor |
| FR-39 | The full mentor conversation for a ticket is stored and is readable by the user afterward | Must | View Mentor History |
| FR-40 | The mentor conversation transcript is passed to the evaluator as part of scoring (feeds the 15% "problem-solving & communication evidence" rubric category — see 2.1.6) | Must | (system) |
| FR-41 | Mentor messages are rate-limited per ticket to control AI cost | Should | (system) |

### 2.1.6 Submission & Evaluation

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-42 | A user can push commits and submit a real PR/diff against their repo, checked via the GitHub API (required — not a diff-paste fallback, per team decision) | Must | Submit Work |
| FR-43 | On submission, GitHub Actions runs the starter template's test suite automatically; the evaluator reads both the diff and the pass/fail result — never the diff alone | Must | (system) |
| FR-44 | The first submission on a ticket produces feedback only — no score | Must | Get Feedback |
| FR-45 | After the first submission, the user can revise their code and submit again (resubmission) | Must | Revise & Resubmit |
| FR-46 | The resubmission is scored by the evaluator (Groq) against the fixed rubric: 40% requirements met, 25% correctness & tests, 20% code quality, 15% problem-solving & communication evidence — and this score is final for V1, not iterative | Must | Get Score |
| FR-47 | The scored breakdown (all four category scores, not just a total) is shown to the user | Must | Get Score |
| FR-48 | Once scored, the ticket moves to `done` and the next ticket becomes available | Must | (system) |
| FR-49 | If the evaluator or GitHub Actions call fails (timeout, API error), the user sees a clear retry state, not a stuck spinner or a silently lost submission | Must | (edge case) |

### 2.1.7 Experience Profile

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-50 | A user can view a profile page listing every completed ticket, its diff, feedback, and rubric score | Must | View Profile |
| FR-51 | The profile is explicitly labeled as a practice work-sample record, not a certified or employer-verified credential (per the problem/solution doc's open assumption on this) | Must | View Profile |
| FR-52 | Public/shareable profile links | **Out of scope for V1** (V2 — see problem/solution doc, 1.5) | — |

### 2.1.8 Unresolved / Needs a Decision

| ID | Requirement | Priority | Linked Use Case |
|---|---|---|---|
| FR-53 | "Voxide" integration — purpose and scope unknown; `TBD` until the team defines what this is | **TBD** | — |

---

## 2.2 Non-Functional Requirements

| Category | Requirement | How it's verified |
|---|---|---|
| Performance | Mentor chat responses begin streaming/returning within ~3s at p95; evaluator scoring (async, "wait for review" moment) may take longer, target under 30s at p95 | Manual timing during testing; revisit if it feels slow in practice |
| Security | Passwords hashed with bcrypt, never logged or returned in any response (already built) | Code review checklist |
| Security | Refresh tokens stored hashed, never in plaintext; rotated on every use (already built) | Code review checklist |
| Security | Chapa webhook signature verified on every call; unsigned requests rejected (FR-19) | Code review + a deliberate bad-signature test case |
| Security | GitHub OAuth token scoped to minimum (repo create/push only), never logged (already decided) | Code review checklist |
| Security | No raw payment/card data stored anywhere in the platform's own DB (FR-17) | Code review checklist |
| Availability | Subscription and ticket state persisted in the DB, not in memory — a server restart must not lose a user's paid status or in-progress ticket | Manual restart test during integration testing |
| Availability | N/A for formal uptime target — this is a hackathon/practice project, not a production SLA | — |
| Scalability | Supports at least 50 concurrent users during the demo without architectural changes | Reviewed at design time; light load test if time allows |
| Observability | All errors logged via Pino with a request ID (already built) | Code review checklist |
| Observability | Payment webhook events (received, verified, rejected) are logged distinctly from general request logs, for billing-dispute troubleshooting | Code review checklist |
| Cost control | AI usage (mentor + evaluator + ticket generation) stays within a defined per-user, per-ticket budget — enforced by the rate limit in FR-41 and by not re-running the evaluator more than the two defined passes (FR-44/FR-46) | Reviewed at design time; monitor actual usage during testing |
| Accessibility | All interactive elements keyboard-navigable (inherited from shadcn/Radix, already in the frontend template) | Manual spot-check |
| Data retention | Payment/subscription records retained indefinitely for accounting; no user data deleted without explicit action (account deletion itself is out of scope for V1 — see 2.3) | Code review checklist |

---

## 2.3 Explicitly Out of Requirements (for V1 — not forgotten, deliberately deferred)

- Account deletion / deactivation / data export (self-service) — no GDPR-style requirement assumed for V1; revisit if the team decides otherwise
- Admin panel of any kind — direct DB access covers the team's needs during the hackathon
- MFA, passkeys, CAPTCHA, device-management dashboard, login history UI
- Async product notifications (e.g. "your review is ready" email) — the ticket loop is synchronous for V1; this is distinct from transactional email (verification, password reset, payment receipts/failures), which **is** in scope (FR-05 to FR-08, FR-22)
- User-uploaded profile content — no avatar, resume, or portfolio upload; the profile is 100% generated from completed tickets
- Self-service refunds — handled manually via the Chapa dashboard for V1
- Public/shareable profile links, streaks, leaderboards — the "why come back tomorrow" hook, explicitly deferred to V2 per the problem/solution doc
- Search, filtering, bulk operations, import/export — not meaningful at V1's scale (one active ticket at a time, no large lists to manage yet)
- Comments, reactions, sharing, favorites — no relevant entity in this product needs them at V1
- Multi-tenant / organization / team features — Work Simulator V1 is single-learner; no org-level user type exists
- Localization / multi-language support

---

*Numbering convention: FR-01, FR-02... is a single continuous sequence across the whole document, not reset per section. Never renumber once the project starts — if a requirement is dropped, mark it `~~FR-XX~~ (deprecated, see FR-YY)` instead, so old PR/issue references don't silently point at the wrong thing.*

Next: proceed to → [3. Use Cases]
