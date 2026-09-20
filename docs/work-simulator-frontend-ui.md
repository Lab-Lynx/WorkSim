# 6. Frontend — UI, Pages & Components

Project: Work Simulator · Links back to: [5. API Specification](./work-simulator-api-spec.md)

Every page and component here traces back to a Use Case (descriptive placeholders from doc 2 until doc 3's IDs exist, see A-35) and forward to a file in [7. Folder & File Structure]. The file paths below are proposals until doc 7 exists (A-36). `EP-##` means an endpoint in doc 5, section 5.3.

**Decisions this doc is built on** (locked or confirmed with the team):
- Auth is email + password. Sessions are httpOnly access + refresh cookies, so frontend code never reads or stores a token. GitHub is connected separately, after login, for repo access only
- Chapa is confirmed only by a verified webhook. The checkout return page never activates anything; it only polls EP-15 (FR-18)
- Gemini is the mentor, Groq is the evaluator. The rubric is fixed at 40 / 25 / 20 / 15 and is shown to the user exactly as fixed
- Two-pass flow: first submission = feedback only, resubmission = final score, final for V1. Ticket statuses are exactly `assigned → in_progress → submitted_v1 → resubmitted → done`, plus `abandoned` (only reachable before submission)
- A real GitHub PR/diff is required. The UI never offers a paste-a-diff fallback
- One active ticket at a time
- The starter template picker offers React and Node/Express only. Django is unconfirmed and is not shown
- "Voxide" is still undefined (FR-53), so no page, component or hook exists for it
- Deferred by doc 2, section 2.3, so no UI exists for them: account deletion, self-service refunds, admin panel, MFA, uploads, search/filter/bulk actions, public profile links, localization

**Source note:** docs 2 and 5 were available. Docs 3 (use cases) and 4 (database) were not. Request and response shapes come from doc 5, so any risk doc 5 flags (for example A-20, the assumed built-auth shapes) carries over here. A 42-topic frontend checklist was also supplied. It was used only to check coverage (section 6.6), not as a source of requirements. Where it lists something doc 2 excludes, doc 2 wins.

**What this doc adds to the template:** a `PG-##` ID on every page, and sections 6.5 to 6.9 (shared behavior, checklist coverage, assumptions, open questions, changes to earlier docs), mirroring how doc 5 ends.

---

## 6.1 Page Inventory

| ID | Route | Page component | Public/Protected | Layout | Linked Use Case | Linked FR |
|---|---|---|---|---|---|---|
| PG-01 | `/register` | RegisterPage | Public (logged-in users go to `/dashboard`) | AuthLayout | Register | FR-01, FR-02, FR-03, FR-05 |
| PG-02 | `/login` | LoginPage | Public (logged-in users go to `/dashboard`) | AuthLayout | Login | FR-04, FR-12 |
| PG-03 | `/forgot-password` | ForgotPasswordPage | Public (logged-in users go to `/dashboard`) | AuthLayout | Reset Password | FR-07 |
| PG-04 | `/reset-password?token=…` | ResetPasswordPage | Public (any login state) | AuthLayout | Reset Password | FR-07, FR-08 |
| PG-05 | `/verify-email?token=…` | VerifyEmailPage | Public (any login state) | AuthLayout | Verify Email | FR-05, FR-06 |
| PG-06 | `/dashboard` | DashboardPage | Protected | AppLayout | Get Ticket, View Ticket (entry point to Subscribe, Connect GitHub, Start Project) | FR-15, FR-26, FR-30, FR-34 |
| PG-07 | `/billing` | BillingPage | Protected | AppLayout | Subscribe, View Subscription, Cancel Subscription, View Billing History, Payment Failed | FR-15 – FR-17, FR-20 – FR-23 |
| PG-08 | `/billing/return` | CheckoutReturnPage | Protected | AppLayout | Subscribe | FR-18 |
| PG-09 | `/github` | GitHubSetupPage | Protected | AppLayout | Connect GitHub, Disconnect GitHub, Start Project | FR-25 – FR-29 |
| PG-10 | `/tickets/:ticketId` | TicketPage | Protected | AppLayout | View Ticket, Start Ticket, Get Ticket, Ask Mentor, View Mentor History, Submit Work, Revise & Resubmit, Get Feedback, Get Score, Abandon Ticket, View Past Ticket | FR-30, FR-32 – FR-39, FR-41 – FR-49 |
| PG-11 | `/profile` | ExperienceProfilePage | Protected | AppLayout | View Profile | FR-36, FR-50, FR-51 |
| PG-12 | `/settings` | SettingsPage | Protected | AppLayout | Edit Profile, Change Password, Logout Everywhere, Verify Email (resend) | FR-05, FR-09, FR-11, FR-13 |
| PG-13 | `*` | NotFoundPage | Public | AuthLayout when logged out, AppLayout when logged in | (system) | — |

Not pages: `/` renders no UI and redirects (6.5.1). Logout (FR-10) is an action in AppLayout's user menu. FR-14, FR-24, FR-52 and FR-53 have no UI by design. FR-12 (login rate limit) appears only as the 429 message on PG-02.

---

## 6.2 Page Detail

Shared form behavior (section 6.5.6), shared error handling (6.5.3), and shared accessibility rules (6.5.8) apply to every page below and are not repeated in each block.

### PG-01 · RegisterPage (`src/pages/auth/RegisterPage.tsx`)

**Purpose:** Create an account with name, email and password.

**Traces to:** FR-01, FR-02, FR-03, FR-05 · EP-01, EP-07

**Layout description:** Centered card (AuthLayout). Top to bottom: heading "Create your account"; name field; email field; password field with a show/hide toggle and the hint "At least 8 characters"; a form-level error area; a full-width "Create account" button; the line "Already have an account? Log in".

On success the card content is replaced, in place, by a "Check your email" view: "We've sent a verification link to {email}. If it doesn't arrive, you can send it again." A "Resend verification email" button and a "Go to login" link sit below. Registering does not log the user in (EP-01), so login is the next step.

The template's example `referralCode` field is not part of V1: FR-01 lists name, email and password only.

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Input, Label, Button, Alert | `src/components/ui/` | shadcn primitives, unmodified |
| AuthLayout | `src/components/layout/` | shared shell for PG-01 – PG-05 |
| PasswordInput | `src/components/common/` | Input + show/hide toggle |
| FormRootError | `src/components/common/` | renders `errors.root` |
| SubmitButton | `src/components/common/` | pending state, prevents double submit |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Submit registration | `POST /auth/register` (EP-01) | `useRegister` (mutation) |
| Resend verification email | `POST /auth/resend-verification` (EP-07) | `useResendVerification` (mutation) |

**Form fields & validation** (mirrors the Zod schema used with react-hook-form):

| Field | Type | Validation |
|---|---|---|
| name | text | trimmed, min 2 chars |
| email | email | trimmed, valid email format |
| password | password | min 8 chars, message "Password must be at least 8 characters" (FR-03) |

Server error mapping: 409 sets the message "Email already in use" on the email field (FR-02, A-41). Any other server error goes to `errors.root`.

**States to handle explicitly:**
- [ ] Loading (submit in progress): button disabled, spinner, label "Creating account…", fields read-only
- [ ] Error: field-level (client validation, and 409 on email) and form-level (`errors.root`) for a server 400 or a network failure
- [ ] Success: in-page "Check your email" view (no redirect). Focus moves to its heading
- [ ] Resend: button disabled during the request and for a 60 s cooldown afterward (A-42). The server's message is shown as returned (EP-07 answers the same way every time). 429 and network errors show inline
- [ ] Already logged in: redirect to `/dashboard`

### PG-02 · LoginPage (`src/pages/auth/LoginPage.tsx`)

**Purpose:** Log in with email and password.

**Traces to:** FR-04, FR-12 · EP-02

**Layout description:** Centered card. Top to bottom: an optional notice banner (see states); heading "Log in"; email field; password field with show/hide toggle; a form-level error area; "Log in" button; links "Forgot your password?" (to PG-03) and "Create an account" (to PG-01).

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Input, Label, Button, Alert | `src/components/ui/` | shadcn primitives, unmodified |
| AuthLayout, PasswordInput, FormRootError, SubmitButton | see PG-01 | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Log in | `POST /auth/login` (EP-02) | `useLogin` (mutation). On success the returned `user` is written to the `['me']` cache |

**Form fields & validation:**

| Field | Type | Validation |
|---|---|---|
| email | email | trimmed, valid email format |
| password | password | required (non-empty). No length rule at login, because doc 5 gives none |

**States to handle explicitly:**
- [ ] Loading: button disabled, spinner, label "Logging in…"
- [ ] Error: 401 "Invalid email or password" shows in `errors.root`, the password field is cleared and focused, the email is kept. 429 shows the server message in `errors.root`. 400 and network errors show in `errors.root`
- [ ] Success: navigate with `replace` to the `from` path if it is safe (6.5.1), otherwise `/dashboard`. Login does not check `emailVerifiedAt` (EP-02), so an unverified user still gets in and sees the banner (A-39)
- [ ] Notice banner, read from router state: "Your session expired. Log in again." (6.5.2), "Password reset. Log in with your new password." (PG-04), "You've been logged out of all devices." (PG-12)
- [ ] Already logged in: redirect to `/dashboard`

### PG-03 · ForgotPasswordPage (`src/pages/auth/ForgotPasswordPage.tsx`)

**Purpose:** Request a password reset link by email.

**Traces to:** FR-07 · EP-08

**Layout description:** Centered card. Heading "Reset your password"; one line of explanation; email field; "Send reset link" button; "Back to login" link. On success the form is replaced by the server's message and a "Back to login" link, plus a "Use a different email" button that returns to the form.

**Components used:** Card, Input, Label, Button, Alert (shadcn, unmodified); AuthLayout, FormRootError, SubmitButton (see PG-01).

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Request reset link | `POST /auth/forgot-password` (EP-08) | `useForgotPassword` (mutation) |

**Form fields & validation:**

| Field | Type | Validation |
|---|---|---|
| email | email | trimmed, valid email format |

**States to handle explicitly:**
- [ ] Loading: button disabled, spinner, label "Sending…"
- [ ] Error: 400, 429 and network errors show in `errors.root`
- [ ] Success: the server's message is shown as returned. It is identical whether or not the email has an account (EP-08), so the UI must not add wording that hints either way
- [ ] Already logged in: redirect to `/dashboard`

### PG-04 · ResetPasswordPage (`src/pages/auth/ResetPasswordPage.tsx`)

**Purpose:** Set a new password using the token from the emailed link.

**Traces to:** FR-07, FR-08 · EP-09

**Layout description:** Centered card. Heading "Choose a new password"; new-password field with show/hide toggle and the hint "At least 8 characters"; "Reset password" button. The token is read from the `?token=` query parameter. The page has no external links or third-party resources, so the token cannot leak through a referrer (6.5.9).

**Components used:** Card, Label, Button, Alert (shadcn, unmodified); AuthLayout, PasswordInput, FormRootError, SubmitButton (see PG-01).

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Reset password | `POST /auth/reset-password` (EP-09) | `useResetPassword` (mutation) |

**Form fields & validation:**

| Field | Type | Validation |
|---|---|---|
| newPassword | password | min 8 chars, message "Password must be at least 8 characters" |
| token | (from URL, not a visible field) | present. A missing or empty token skips the form entirely |

**States to handle explicitly:**
- [ ] No token in the URL: show the "invalid link" view immediately, without calling the API
- [ ] Loading: button disabled, spinner, label "Resetting…"
- [ ] Invalid link (400 "Invalid reset link"): view with the message and a link to `/forgot-password`
- [ ] Expired or already used (410): the server message ("expired" or "already been used") plus a "Request a new link" button to `/forgot-password`. The password is not changed (FR-08)
- [ ] Validation or network error: `errors.root`
- [ ] Success: navigate with `replace` to `/login` with the "Password reset" notice. Whether other sessions are also revoked is open (Q-11), and the UI does not depend on it

### PG-05 · VerifyEmailPage (`src/pages/auth/VerifyEmailPage.tsx`)

**Purpose:** Confirm the email address using the token from the emailed link.

**Traces to:** FR-05, FR-06 · EP-06, EP-07

**Layout description:** Centered card. It shows one of four views, decided by the request outcome. Verifying: a small spinner with "Verifying your email…". Success: "Your email is verified" and one button ("Go to dashboard" if logged in, otherwise "Go to login"). Problem (invalid, expired, used): the server message, then "Send a new verification link" with an email field (prefilled from the `['me']` cache when logged in) and a send button.

The page calls EP-06 automatically on load, exactly once per page load. The call is guarded so that React StrictMode's double effect in development cannot send it twice (the second call would come back as "already used"). A missing token skips the call and shows the invalid view.

**Components used:** Card, Input, Label, Button, Alert (shadcn, unmodified); AuthLayout, FormRootError, SubmitButton (see PG-01).

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Verify token | `POST /auth/verify-email` (EP-06) | `useVerifyEmail` (mutation, fired once on mount) |
| Send new link | `POST /auth/resend-verification` (EP-07) | `useResendVerification` (mutation) |

**Form fields & validation** (resend form only):

| Field | Type | Validation |
|---|---|---|
| email | email | trimmed, valid email format |

**States to handle explicitly:**
- [ ] Verifying (request in flight)
- [ ] Success: `emailVerifiedAt` is written to the `['me']` cache if the user is logged in, so the banner disappears
- [ ] Invalid (400 "Invalid verification link"): message + resend form
- [ ] Expired or already used (410): the server message + resend form (FR-06). No message matching is needed; both 410 cases offer the same recovery
- [ ] Resend: same behavior as PG-01 (server message as returned, 60 s cooldown, 429 inline)
- [ ] Refreshing after success returns "already used". The message is accurate, and a logged-in user also sees a "Go to dashboard" link
- [ ] Network error: `ErrorState` with a Retry button that re-fires EP-06

### PG-06 · DashboardPage (`src/pages/dashboard/DashboardPage.tsx`)

**Purpose:** Show the user their next step, or their current ticket.

**Traces to:** FR-15, FR-26, FR-30, FR-34 · EP-11, EP-15, EP-20, EP-23, EP-24

**Layout description:** Top to bottom: page heading with the user's name; a "Get started" checklist card; a "Current ticket" card.

The checklist has four steps in order: (1) Subscribe, (2) Connect GitHub, (3) Create your starter repository, (4) Get your first ticket. A finished step shows a check and its result (for example "Connected as @login"). The first unfinished step is highlighted and holds the one primary button, which links to the right page (PG-07 or PG-09) or, for step 4, calls EP-23. Steps are derived, not stored (`useSetupProgress`):

| Step | Done when |
|---|---|
| 1 Subscribe | `hasAccess` is `true` (EP-15) |
| 2 Connect GitHub | `connected` is `true` (EP-20). If `connected` is `false` but a `repo` exists, the step is unfinished and reads "Reconnect GitHub" (FR-26, doc 4 A-07) |
| 3 Create repository | `repo` is not `null` (EP-20) |
| 4 Get ticket | an active ticket exists (EP-24) |

The checklist collapses to a one-line summary once steps 1–3 are done and a ticket exists. The "Current ticket" card shows the ticket title, category and difficulty, a phase label (see PG-10) and a "Continue" button to `/tickets/:ticketId`. With no active ticket, and steps 1–3 done, it shows "Get your next ticket" and a button that calls EP-23.

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Button, Skeleton, Alert | `src/components/ui/` | shadcn primitives, unmodified |
| SetupChecklist | `src/components/dashboard/` | the four steps |
| CurrentTicketCard | `src/components/dashboard/` | ticket summary or "get ticket" prompt |
| StatusBadge, ErrorState, SubmitButton | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Current user | `GET /users/me` (EP-11) | `useMe` |
| Subscription and `hasAccess` | `GET /subscriptions/me` (EP-15) | `useSubscription` |
| GitHub connection and repo | `GET /github/connection` (EP-20) | `useGitHubConnection` |
| Active ticket | `GET /tickets/current` (EP-24) | `useCurrentTicket` |
| Assign next ticket | `POST /tickets` (EP-23) | `useAssignTicket` (mutation) |
| Derived next step | the four queries above | `useSetupProgress` |

**States to handle explicitly:**
- [ ] Loading: skeleton for the checklist card and the ticket card (no full-page spinner)
- [ ] Partial data: each card fails on its own. A failed query shows `ErrorState` with Retry inside that card, and the other card still renders
- [ ] Empty (no ticket yet): the checklist is the main content
- [ ] Subscription lapsed (`hasAccess` false after having a subscription): step 1 reads "Subscribe again", and the ticket card stays viewable, but "Get ticket" is disabled with the reason
- [ ] Get ticket, loading: button disabled, label "Getting your ticket…" (this call runs Gemini and creates a branch, so it can take several seconds)
- [ ] Get ticket, success: navigate to `/tickets/:ticketId`
- [ ] Get ticket, errors (per 6.5.3): 402 goes to PG-07; 403 goes to PG-09 with the server message; 409 "no repo yet" goes to PG-09; 409 "already has an active ticket" refetches EP-24 and shows the current ticket; 502 shows the server message inline with a Retry button

### PG-07 · BillingPage (`src/pages/billing/BillingPage.tsx`)

**Purpose:** Subscribe, see subscription status and the next billing date, cancel, and view payment history.

**Traces to:** FR-15, FR-16, FR-17, FR-20, FR-21, FR-22, FR-23 · EP-13, EP-15, EP-16, EP-17

**Layout description:** Two cards, top to bottom. "Subscription": a status badge, a line of plain text, and one action button as the table below shows. Under the Subscribe button: "You'll pay on Chapa's secure page. Work Simulator never sees your card details." (FR-17). "Payment history": a table on `md` and up, one card per payment below `md` (columns: date, amount and currency, status).

The subscription card shows one of these cases. `subscription` and `hasAccess` come from EP-15:

| `subscription` | `hasAccess` | Badge and text | Action |
|---|---|---|---|
| `null` | false | "Not subscribed" | Subscribe |
| `active` | true | "Active. Next billing date: {currentPeriodEnd}" | Cancel subscription |
| `active` | false | "Renewal pending. Your billing period ended {currentPeriodEnd}. Waiting for Chapa to confirm the renewal." | none (the card refetches on window focus) |
| `past_due` | true | "Payment failed. Your access ends {currentPeriodEnd}." | none (Q-15) |
| `past_due` | false | "Payment failed. Your access has ended." | none (Q-15) |
| `canceled` | true | "Canceled. Access ends {currentPeriodEnd}." | none until access ends (A-48) |
| `canceled` | false | "Subscription ended {currentPeriodEnd}." | Subscribe |

The next billing date is `currentPeriodEnd`. The API has no separate field (A-48). No price is shown before checkout, because no endpoint returns it (Q-14).

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Button, Badge, Skeleton, Alert | `src/components/ui/` | shadcn primitives, unmodified |
| SubscriptionCard | `src/components/billing/` | the table above |
| PaymentHistory | `src/components/billing/` | table above `md`, cards below |
| ConfirmDialog | `src/components/common/` | cancel confirmation |
| StatusBadge, EmptyState, ErrorState, SubmitButton | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Subscription status | `GET /subscriptions/me` (EP-15) | `useSubscription` |
| Payment history | `GET /payments` (EP-17) | `usePayments` |
| Start checkout | `POST /subscriptions/checkout` (EP-13) | `useStartCheckout` (mutation) |
| Cancel | `POST /subscriptions/cancel` (EP-16) | `useCancelSubscription` (mutation) |

**States to handle explicitly:**
- [ ] Loading: skeleton per card
- [ ] Error: `ErrorState` with Retry, per card, independent of each other
- [ ] Empty payments: "No payments yet." No next action is needed on this card
- [ ] Payment `pending`: badge "Pending". `paidAt` is null, so the date column shows `createdAt`
- [ ] Subscribe, loading: button disabled with a spinner, label "Opening Chapa…". On 201 the browser navigates (same tab) to `checkoutUrl`, and the button stays disabled until the page unloads, so a second click cannot create a second pending payment
- [ ] Subscribe, errors: 409 "already have an active subscription" refetches EP-15 (the card then shows the right state); 502 shows the server message with Retry
- [ ] Cancel: `ConfirmDialog` text is "Your access continues until {currentPeriodEnd}, then ends. Future charges will stop." Confirm label "Cancel subscription". On success EP-15 is refetched. 409 refetches and closes the dialog. 502 keeps the dialog open with the server message and an enabled confirm button
- [ ] Payment failed (FR-22): the badge and text above, plus `SubscriptionBanner` in AppLayout. The failure email is sent by the backend

### PG-08 · CheckoutReturnPage (`src/pages/billing/CheckoutReturnPage.tsx`)

**Purpose:** The page Chapa returns the browser to. It waits for the webhook to activate the subscription. Reaching this page confirms nothing (FR-18).

**Traces to:** FR-18 · EP-13 (`return_url`), EP-15

**Layout description:** One centered card inside AppLayout showing one of four views: "Confirming your payment" (spinner, and the line "We're waiting for Chapa to confirm. This usually takes a few seconds."); "You're subscribed" (with a "Connect GitHub" button to `/github`); "We haven't received confirmation yet" (with "Check again" and "Go to Billing" buttons); or a network `ErrorState`.

The page ignores any query parameters Chapa may add (A-37). The only source of truth is EP-15.

**Components used:** Card, Button, Alert (shadcn, unmodified); ErrorState (common).

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Subscription status, polled | `GET /subscriptions/me` (EP-15) | `useSubscription` with polling on (timings in 6.5.5) |

**States to handle explicitly:**
- [ ] Confirming: poll EP-15 every 2 s for up to 60 s (A-42). The status region is announced to screen readers
- [ ] Confirmed: stop polling once `subscription.status` is `active` and `hasAccess` is `true`. Show the success view
- [ ] Not confirmed after 60 s: "We haven't received confirmation from Chapa yet. If you completed the payment it can take a few minutes. Don't pay again. If you canceled at checkout, you can start again from Billing." Buttons: "Check again" (restarts the poll) and "Go to Billing"
- [ ] Network error while polling: `ErrorState` with Retry
- [ ] Page reloaded: polling restarts from zero. If access is already active, the page goes straight to Confirmed

### PG-09 · GitHubSetupPage (`src/pages/github/GitHubSetupPage.tsx`)

**Purpose:** Connect or disconnect GitHub, and create the one starter repository. This is also the landing page for the GitHub OAuth callback (EP-19).

**Traces to:** FR-25, FR-26, FR-27, FR-28, FR-29 · EP-18, EP-19, EP-20, EP-21, EP-22

**Layout description:** Two cards, top to bottom, under an optional result alert. The alert appears when the URL has `?github=connected` or `?github=error&reason=…`. Once shown, the params are removed from the URL with `replace` so a refresh does not repeat it.

Card 1, "GitHub connection". Not connected: a short explanation ("Work Simulator needs permission to create a repository in your account and push to it."), and a "Connect GitHub" button. Connected: "Connected as @{githubLogin}" and a "Disconnect GitHub" button. The permission wording depends on the exact scope (Q-08).

Card 2, "Starter repository". If a repo exists: `RepoSummary` (owner/name as an external link, template, default branch) and a "Go to dashboard" button. There is no create form, because there is one repo per user. If no repo, and GitHub is connected, and the user has access: a form with a template choice (radio group: React, Node/Express, no default selected) and a repository name field (prefilled `work-simulator`). If GitHub is not connected or access has lapsed, the form is replaced by a message and the right link.

OAuth error text, by `reason`:

| `reason` | Message |
|---|---|
| `state_invalid` | "The connection attempt expired or didn't match your session. Try connecting again." |
| `scope_invalid` | "GitHub returned different permissions than Work Simulator asks for, so the connection was not saved. Try again." |
| `exchange_failed` | "GitHub couldn't complete the connection. Try again." |
| anything else | "GitHub connection failed. Try again." (covers a canceled authorization, see Q-16) |

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Button, Input, Label, RadioGroup, Alert, Skeleton | `src/components/ui/` | shadcn primitives, unmodified |
| GitHubConnectionCard | `src/components/github/` | card 1 |
| RepoCreateForm | `src/components/github/` | the form in card 2 |
| RepoSummary | `src/components/github/` | existing-repo view |
| ConfirmDialog, ExternalLink, FormRootError, SubmitButton, ErrorState | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Connection and repo | `GET /github/connection` (EP-20) | `useGitHubConnection` |
| Access (to enable Connect) | `GET /subscriptions/me` (EP-15) | `useSubscription` |
| Start OAuth | `GET /github/connect` (EP-18) | `useGitHubConnect` (mutation; the page then navigates to `authorizeUrl`) |
| Disconnect | `DELETE /github/connection` (EP-21) | `useDisconnectGitHub` (mutation) |
| Create repo | `POST /github/repo` (EP-22) | `useCreateRepo` (mutation) |

**Form fields & validation** (repo form):

| Field | Type | Validation |
|---|---|---|
| starterTemplate | radio | required; `react` or `node_express` |
| repoName | text | optional; default `work-simulator`; must match `^[A-Za-z0-9._-]{1,100}$` and not be `.` or `..` (A-45, client-side convenience only; the server is authoritative) |

**States to handle explicitly:**
- [ ] Loading: skeleton per card
- [ ] Error loading EP-20: `ErrorState` with Retry
- [ ] Connect, loading: button disabled and "Redirecting to GitHub…" while EP-18 runs and the browser navigates (same tab). 402 shows "An active subscription is required" with a link to PG-07. The button is disabled up front when `hasAccess` is false
- [ ] Connected result (`?github=connected`): success alert, and the repo card is now the next step
- [ ] Error result (`?github=error`): alert with the text above and a "Connect GitHub" button
- [ ] Disconnect: `ConfirmDialog` text is "Your past submissions are kept. You won't be able to start or submit tickets until you reconnect. This doesn't remove Work Simulator's access on GitHub. To do that, use your GitHub settings." (A-32). 404 "not connected" refetches EP-20 and closes the dialog
- [ ] Token revoked (FR-29): any GitHub-dependent call that returns 403 "no longer valid" means the connection row is already deleted. Refetch EP-20, show the server message in an alert, and show the Connect button
- [ ] Create repo, loading: form disabled, button label "Creating repository…"
- [ ] Create repo, success: `RepoSummary` replaces the form. Focus moves to it
- [ ] Create repo, errors (FR-28): 409 shows the server message in `errors.root` (it says whether it is a name collision or an existing repo), moves focus to the repo name field, and refetches EP-20 in case the repo now exists. 403 refetches EP-20 and shows the server message with the Connect button. 402 links to PG-07. 502 shows the server message and leaves the form filled so the user can retry. 400 shows in `errors.root`
- [ ] Django is not offered (unconfirmed)

### PG-10 · TicketPage (`src/pages/tickets/TicketPage.tsx`)

**Purpose:** The workspace for one ticket: read it, start it, ask the mentor, submit, read feedback, resubmit, and see the final score. The same page shows current and past (`done`, `abandoned`) tickets.

**Traces to:** FR-30, FR-32 – FR-39, FR-41 – FR-49 · EP-23 – EP-32

**Layout description:** Top to bottom, at every screen size:

1. **Header:** title, `StatusBadge` with the phase label (table below), category and difficulty badges (shown as given, A-50).
2. **Action bar** (`TicketActionBar`): one line saying what to do now, and the one primary button for the current phase. It stays visible above the tabs.
3. **Tabs** (`?tab=ticket`, `?tab=mentor`, `?tab=submissions`; tab changes use `replace`, so Back leaves the page):
   - **Ticket:** the scenario; touched files (as code-style paths); acceptance criteria; test checklist (both read-only lists shown before work starts, FR-32); `BranchInstructions` (repo link, branch link, and the commands `git fetch origin` and `git checkout {branchName}` with a copy button). The default tab is Ticket for `assigned`, `in_progress` and `abandoned`.
   - **Mentor:** the message list (oldest first) and the composer. A note under the composer: "Your mentor conversation is included in your final review." (FR-40)
   - **Submissions:** one card per attempt (0–2), each with: attempt label, submitted time, status, a tests badge ("Tests passed", "Tests failed", "Tests pending" from `ciPassed`), links to the pull request and the CI run (new tab), the evaluation, and a collapsed "View diff" section. Attempt 1 is labeled "First review: feedback only, not scored". Attempt 2 is labeled "Final review". The default tab is Submissions for `submitted_v1`, `resubmitted` and `done`.
4. **Abandon** ("Abandon ticket", destructive style) sits at the bottom of the Ticket tab, only while the ticket can still be abandoned.

The phase is derived from `ticket.status` plus the latest submission's `status` (A-43):

| Ticket status | Latest submission | Phase label | Primary action | Mentor composer | Abandon |
|---|---|---|---|---|---|
| `assigned` | none | Ready to start | "Start working" (EP-26) | Disabled: "Start the ticket to use the mentor." | Yes |
| `in_progress` | none | In progress | "Submit for feedback" (EP-30). Helper text: "Your first submission gets feedback only, no score. You can then revise and resubmit once for your final score." | Enabled | Yes |
| `submitted_v1` | #1 `awaiting_ci` or `evaluating` | First review in progress | none (wait) | Disabled: "The mentor is only available while the ticket is in progress." | No |
| `submitted_v1` | #1 `completed` | Feedback ready | "Resubmit for final score" (EP-30, with confirmation, below) | Disabled (same text) | No |
| `submitted_v1` | #1 `failed` | Review failed | "Retry review" (EP-32) | Disabled (same text) | No |
| `resubmitted` | #2 `awaiting_ci` or `evaluating` | Final review in progress | none (wait) | Disabled (same text) | No |
| `resubmitted` | #2 `failed` | Final review failed | "Retry review" (EP-32) | Disabled (same text) | No |
| `done` | #2 `completed` | Done | "Get next ticket" (EP-23) | Read-only history | No |
| `abandoned` | any or none | Abandoned | none | Read-only history | No |

The composer is disabled in `submitted_v1` and `resubmitted` because EP-28 rejects messages then (Q-10c). If the team reverses that, only this table changes.

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Tabs, Button, Badge, Skeleton, Alert, Textarea, Progress | `src/components/ui/` | shadcn primitives, unmodified |
| TicketHeader | `src/components/ticket/` | title, phase badge, category, difficulty |
| TicketActionBar | `src/components/ticket/` | phase message + primary button |
| TicketDetails | `src/components/ticket/` | scenario, touched files, criteria, checklist |
| BranchInstructions | `src/components/ticket/` | repo/branch links, git commands |
| MentorPanel (with MentorMessageList, MentorComposer) | `src/components/ticket/` | mentor tab |
| SubmissionsPanel (with SubmissionCard) | `src/components/ticket/` | submissions tab |
| EvaluationView, ScoreBreakdown | `src/components/ticket/` | feedback text; four category scores + total |
| DiffViewer | `src/components/ticket/` | plain-text diff with +/- line styling (A-46) |
| ConfirmDialog, ExternalLink, CopyButton, StatusBadge, ErrorState, SubmitButton | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Ticket + submission summaries | `GET /tickets/:ticketId` (EP-25) | `useTicket` |
| Access (to enable actions) | `GET /subscriptions/me` (EP-15) | `useSubscription` |
| Start ticket | `POST /tickets/:ticketId/start` (EP-26) | `useStartTicket` |
| Abandon ticket | `POST /tickets/:ticketId/abandon` (EP-27) | `useAbandonTicket` |
| Next ticket (from `done`) | `POST /tickets` (EP-23) | `useAssignTicket` |
| Mentor history | `GET /tickets/:ticketId/mentor/messages` (EP-29) | `useMentorMessages` |
| Send mentor message | `POST /tickets/:ticketId/mentor/messages` (EP-28) | `useSendMentorMessage` |
| Submit / resubmit | `POST /tickets/:ticketId/submissions` (EP-30) | `useSubmitWork` |
| Submission status (polled) and diff | `GET /tickets/:ticketId/submissions/:attempt` (EP-31) | `useSubmission` (`includeDiff` only when the diff section is opened) |
| Retry failed review | `POST …/submissions/:attempt/retry` (EP-32) | `useRetrySubmission` |

**Score display:** `ScoreBreakdown` shows the four category scores (0–100) with their fixed weights, then the weighted total. Weights are constants in `src/config/rubric.ts` and are never changed by the UI:

| Field (`scores.*`) | Label | Weight |
|---|---|---|
| `requirementsMet` | Requirements met | 40% |
| `correctnessTests` | Correctness & tests | 25% |
| `codeQuality` | Code quality | 20% |
| `problemSolving` | Problem-solving & communication | 15% |
| `total` | Total | weighted |

Attempt 1 has `scores: null` and shows the feedback text only, under the label "Not scored".

**States to handle explicitly:**
- [ ] Loading: header and tab skeletons
- [ ] Not found (404, or 400 for a malformed ID): "Ticket not found" with a link to the dashboard. The same text is used for another user's ticket
- [ ] Error (network, 5xx): `ErrorState` with Retry
- [ ] Every phase row in the table above, each with its own message
- [ ] Start ticket: loading (button spinner, "Starting…"), success (the action bar switches to the `in_progress` view, toast "Ticket started"), 409 "already started" (refetch, show current phase)
- [ ] Submit for feedback, loading: button disabled ("Submitting…"). On 202 switch to the Submissions tab and begin polling EP-31 for attempt 1. On 400 "No commits found on branch…" show the server message inline under the button and stay in `in_progress`. On 502 show the server message with Retry
- [ ] Processing (`awaiting_ci`): "Waiting for GitHub Actions to run your tests." (`evaluating`): "The evaluator is reviewing your code and test results." A progress indicator with `role="status"`. After 2 minutes, add: "This is taking longer than usual. You can leave this page; your submission is not lost." After 10 minutes, polling stops automatically and a "Check again" button appears (6.5.5)
- [ ] Failed (`failed`): show `failureReason` and a "Retry review" button (EP-32). A retry re-runs the same submission and is not a new attempt (doc 4, A-12). The submission is never shown as lost (FR-49)
- [ ] Feedback ready (attempt 1 `completed`): feedback text, "Not scored", and the resubmit instructions "Push your changes to `{branchName}`, then resubmit."
- [ ] Resubmit: `ConfirmDialog` text is "Your next submission is scored and final. You won't be able to revise after this." Confirm label "Resubmit for final score". 409 "Wait for feedback…" (only reachable with a stale tab) refetches
- [ ] Final review completed (attempt 2 `completed`): refetch EP-25. If the ticket still reads `resubmitted`, refetch up to 3 more times, 2 s apart, until it reads `done`. Then invalidate `['ticket','current']` and `['profile']`
- [ ] Done: score breakdown, both attempts' feedback, diff sections, read-only mentor history, and a "Get next ticket" button. Errors from EP-23 follow the dashboard list (PG-06)
- [ ] Abandoned: banner "This ticket was abandoned." Read-only mentor history. A link to the dashboard
- [ ] Abandon: `ConfirmDialog` text is "This resets the ticket and gives you a new one. Your mentor conversation is kept and the branch stays in your repository. You can't abandon a ticket after submitting." Confirm label "Abandon ticket". Success with `newTicket`: navigate with `replace` to the new ticket and show a toast. Success with `newTicket: null`: go to the dashboard with the toast "Ticket abandoned. We couldn't issue a new one right now. Try again from the dashboard." (EP-27, A-31). 409 "cannot be abandoned after submission" (stale tab) refetches and closes the dialog
- [ ] Mentor, empty: "Ask the mentor about this ticket. It starts by asking what you've tried, then gives hints. It won't hand you the solution."
- [ ] Mentor, sending: the user's message appears immediately in a pending style (local only; nothing is stored until the mentor replies, A-29), the send button is disabled, and a "Mentor is thinking…" line appears. On 201 both server messages replace the pending one
- [ ] Mentor, failed send: 502 shows "The mentor is unavailable, please try again" under the message with a "Retry" button. The typed text is kept and nothing is duplicated (EP-28 stores nothing on failure). A network error behaves the same
- [ ] Mentor, limit reached (429): the composer is disabled with the server message "Mentor message limit reached for this ticket". History stays readable
- [ ] Mentor, message too long or empty: send is disabled for an empty message. The length counter appears only once the limit is known (A-47); a server 400 is shown inline
- [ ] Subscription lapsed (`hasAccess` false, or any 402): banner "An active subscription is required" with a link to PG-07. Start, Submit, Resubmit, Retry, Abandon, Get next ticket and mentor send are disabled with that reason. Everything else stays readable (doc 5, 5.1)
- [ ] GitHub problem (403 on Abandon, Submit or Get next ticket): show the server message and a "Reconnect GitHub" link to PG-09. The ticket stays readable
- [ ] Stale state (409 on any action, for example the same ticket open in two tabs): show the server message and refetch the ticket

### PG-11 · ExperienceProfilePage (`src/pages/profile/ExperienceProfilePage.tsx`)

**Purpose:** Show the user's completed tickets as a practice work-sample record.

**Traces to:** FR-36, FR-50, FR-51 · EP-34

**Layout description:** Top to bottom: heading "Your experience profile"; `PracticeRecordNotice` ("This is a practice work-sample record. It is not a certified or employer-verified credential."); a count line ("3 completed tickets"); then one card per completed ticket, newest first. Each card shows the title, category and difficulty badges, the completion date, the total score, the four category scores with their weights, and the final feedback text, clamped to a few lines with a "Show full feedback" toggle. Each card links to `/tickets/:ticketId?tab=submissions` ("See feedback history and diff"). Abandoned tickets are not listed (EP-34). There is no share button or public link (FR-52 is V2). The list has no pagination in V1 (EP-34 returns everything).

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Badge, Skeleton, Button | `src/components/ui/` | shadcn primitives, unmodified |
| PracticeRecordNotice | `src/components/profile/` | the FR-51 label; always rendered above the list, including the empty state |
| ExperienceItem | `src/components/profile/` | one completed ticket |
| ScoreBreakdown | `src/components/ticket/` | shared with PG-10 |
| EmptyState, ErrorState | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Completed tickets | `GET /profile` (EP-34) | `useExperienceProfile` |

**States to handle explicitly:**
- [ ] Loading: skeleton cards
- [ ] Empty: "No completed tickets yet. Finish your first ticket and it will appear here." with a button to `/dashboard`
- [ ] Error: `ErrorState` with Retry
- [ ] Loaded: cards as described. Below `md` the four category scores form a 2×2 grid; from `md` up, one row of four

### PG-12 · SettingsPage (`src/pages/settings/SettingsPage.tsx`)

**Purpose:** Edit the display name, change the password, resend the verification email, and log out of all devices.

**Traces to:** FR-05, FR-09, FR-11, FR-13 · EP-05, EP-07, EP-10, EP-11, EP-12

**Layout description:** Three cards, top to bottom. "Profile": name field, the email shown read-only with a badge "Verified" or "Not verified" (and, if not verified, a "Resend verification email" button), and Save / Cancel buttons that appear only when the name has changed. "Password": current password and new password fields (both with show/hide toggles) and a "Change password" button. "Sessions": one destructive button, "Log out of all devices". Email cannot be changed in V1 (EP-12 changes the name only). There is no account deletion (FR-14).

**Components used:**

| Component | Source | Notes |
|---|---|---|
| Card, Input, Label, Button, Badge, Alert | `src/components/ui/` | shadcn primitives, unmodified |
| PasswordInput, FormRootError, SubmitButton, ConfirmDialog | `src/components/common/` | — |

**Data needed:**

| Data | Source | Hook used |
|---|---|---|
| Current user | `GET /users/me` (EP-11) | `useMe` |
| Update name | `PATCH /users/me` (EP-12) | `useUpdateProfile` (mutation; result written to `['me']`) |
| Change password | `POST /auth/change-password` (EP-10) | `useChangePassword` (mutation) |
| Resend verification | `POST /auth/resend-verification` (EP-07) | `useResendVerification` (mutation, using the user's own email) |
| Log out everywhere | `POST /auth/logout-all` (EP-05) | `useLogoutAll` (mutation) |

**Form fields & validation:**

| Field | Form | Type | Validation |
|---|---|---|---|
| name | Profile | text | trimmed, min 2 chars |
| currentPassword | Password | password | required (non-empty) |
| newPassword | Password | password | min 8 chars, message "Password must be at least 8 characters" |

Server error mapping: EP-10 400 with the message "Current password is incorrect" sets that message on `currentPassword` and focuses it (A-41). Any other server error goes to `errors.root`.

**States to handle explicitly:**
- [ ] Loading: skeleton cards (the user comes from the `['me']` cache, so this is usually instant)
- [ ] Profile form: pristine (Save hidden); dirty (Save and Cancel shown, Cancel restores the saved name); saving (Save disabled, "Saving…"); success (toast "Profile updated"); failure (`errors.root`)
- [ ] Password form: saving (disabled, "Changing…"); success (toast "Password changed", form cleared); 400 wrong current password (field error); 401 goes through the session flow (6.5.2)
- [ ] Unsaved changes: while either form is dirty, leaving the page (in-app navigation, tab close or refresh) asks for confirmation (6.5.6)
- [ ] Resend verification: as PG-01 (60 s cooldown, server message as returned)
- [ ] Log out of all devices: `ConfirmDialog` text is "You'll be logged out on every device, including this one." Success goes to `/login` with the notice "You've been logged out of all devices." (A-40)

### PG-13 · NotFoundPage (`src/pages/NotFoundPage.tsx`)

**Purpose:** Handle any route that does not exist.

**Traces to:** none (system).

**Layout description:** Heading "Page not found", one line ("The page you're looking for doesn't exist."), and one button: "Go to dashboard" when logged in, "Go to login" when logged out. It uses AppLayout or AuthLayout to match. No admin routes exist in V1, so `/admin` also lands here.

**Components used:** Button (shadcn, unmodified); AuthLayout, AppLayout.

**Data needed:** none beyond the `['me']` cache to choose the layout.

**States to handle explicitly:**
- [ ] Logged in and logged out variants (above)
- [ ] The page title is "Page not found · Work Simulator" (6.5.8)

---

## 6.3 New Shared Components (beyond shadcn primitives)

Only `Card`, `Input` and `Button` are confirmed to exist in the template. The other shadcn primitives named in this doc (Alert, AlertDialog, Badge, DropdownMenu, Label, Progress, RadioGroup, Sheet, Skeleton, Sonner for toasts, Table, Tabs, Textarea) are added with the shadcn CLI when first needed and are never edited (A-36).

| Component | Location | Purpose | Used on pages |
|---|---|---|---|
| AuthLayout | `src/components/layout/` | Centered-card shell for public pages | PG-01 – PG-05, PG-13 |
| AppLayout | `src/components/layout/` | Header with nav and user menu, skip link, banners, `<main>`. Below `md` the nav collapses into a Sheet | PG-06 – PG-13 |
| FullPageLoader | `src/components/layout/` | The only full-page spinner: shown while the session is restored on first load (6.5.2) | app boot only |
| EmailVerificationBanner | `src/components/layout/` | Shown in AppLayout while `emailVerifiedAt` is null: "Verify your email" with a Resend button | PG-06 – PG-13 |
| SubscriptionBanner | `src/components/layout/` | Shown in AppLayout for `past_due`, canceled-with-time-left, and ended states, linking to PG-07 | PG-06 – PG-13 |
| RequireAuth, PublicOnly, RootRedirect | `src/routes/` | Route wrappers for the redirect rules in 6.5.1. Not visual | all |
| PasswordInput | `src/components/common/` | Input with a show/hide toggle. The toggle is a labeled button. Sets the right `autocomplete` value | PG-01, PG-02, PG-04, PG-12 |
| FormRootError | `src/components/common/` | Renders the form's `errors.root` in an Alert with `role="alert"` | all forms |
| SubmitButton | `src/components/common/` | Button that disables itself and shows a spinner and a pending label while a mutation runs | all forms and actions |
| ErrorState | `src/components/common/` | Inline failure block: the message and a Retry button | PG-05 – PG-12 |
| EmptyState | `src/components/common/` | Short explanation plus one next action | PG-07, PG-11, PG-10 (mentor) |
| StatusBadge | `src/components/common/` | Text label (plus icon) for subscription, payment, ticket phase and submission status. Never color alone | PG-06, PG-07, PG-10 |
| ConfirmDialog | `src/components/common/` | Wraps shadcn AlertDialog. Confirm and Cancel buttons; while pending the confirm button shows a spinner and the dialog cannot be dismissed; an error stays inside the dialog | PG-07, PG-09, PG-10, PG-12 |
| ExternalLink | `src/components/common/` | Opens in a new tab with `rel="noopener noreferrer"` and a screen-reader-only "(opens in a new tab)" | PG-09, PG-10 |
| CopyButton | `src/components/common/` | Copies text; announces "Copied" politely | PG-10 |
| SubscriptionCard | `src/components/billing/` | Renders the case table in PG-07 | PG-07 |
| PaymentHistory | `src/components/billing/` | Table from `md` up, cards below | PG-07 |
| GitHubConnectionCard | `src/components/github/` | Connect / Disconnect, and the result alert | PG-09 |
| RepoCreateForm | `src/components/github/` | Template choice, repo name, submit | PG-09 |
| RepoSummary | `src/components/github/` | Repo name (link), template, default branch | PG-09 |
| SetupChecklist | `src/components/dashboard/` | The four setup steps | PG-06 |
| CurrentTicketCard | `src/components/dashboard/` | Ticket summary or the "get ticket" prompt | PG-06 |
| TicketHeader | `src/components/ticket/` | Title, phase badge, category, difficulty | PG-10 |
| TicketActionBar | `src/components/ticket/` | Phase message and the primary action (table in PG-10) | PG-10 |
| TicketDetails | `src/components/ticket/` | Scenario, touched files, acceptance criteria, test checklist | PG-10 |
| BranchInstructions | `src/components/ticket/` | Repo and branch links, git commands | PG-10 |
| MentorPanel | `src/components/ticket/` | Message list (`MentorMessageList`, `aria-live="polite"`) and composer (`MentorComposer`) | PG-10 |
| SubmissionsPanel | `src/components/ticket/` | One `SubmissionCard` per attempt | PG-10 |
| EvaluationView | `src/components/ticket/` | Feedback text and, when present, the score breakdown | PG-10, PG-11 |
| ScoreBreakdown | `src/components/ticket/` | Four weighted category scores and the total | PG-10, PG-11 |
| DiffViewer | `src/components/ticket/` | Plain-text diff with `+` and `-` line styling, scrolls horizontally inside its own container | PG-10 |
| PracticeRecordNotice | `src/components/profile/` | The FR-51 label | PG-11 |
| ExperienceItem | `src/components/profile/` | One completed ticket card | PG-11 |

---

## 6.4 New Hooks Needed

All are TanStack Query hooks. Location shows the folder; the file is named after the hook (for example `src/hooks/auth/useRegister.ts`). Mutations never retry on their own (6.5.3).

| Hook | Location | Wraps | Purpose | On success |
|---|---|---|---|---|
| useMe | `src/hooks/auth/` | Query, EP-11 | Current user. Its result is the app's "logged in" fact | key `['me']` |
| useRegister | `src/hooks/auth/` | Mutation, EP-01 | Create an account | none |
| useLogin | `src/hooks/auth/` | Mutation, EP-02 | Log in | writes `user` to `['me']` |
| useLogout | `src/hooks/auth/` | Mutation, EP-04 | Log out this device | clears the whole query cache (6.5.2) |
| useLogoutAll | `src/hooks/auth/` | Mutation, EP-05 | Log out every device | clears the whole query cache |
| useVerifyEmail | `src/hooks/auth/` | Mutation, EP-06 | Verify by token | updates `['me']` if cached |
| useResendVerification | `src/hooks/auth/` | Mutation, EP-07 | Send a new verification link | none |
| useForgotPassword | `src/hooks/auth/` | Mutation, EP-08 | Request a reset link | none |
| useResetPassword | `src/hooks/auth/` | Mutation, EP-09 | Set a new password | none |
| useChangePassword | `src/hooks/auth/` | Mutation, EP-10 | Change password | none |
| useUpdateProfile | `src/hooks/auth/` | Mutation, EP-12 | Update the display name | writes `user` to `['me']` |
| useSubscription | `src/hooks/billing/` | Query, EP-15 | Status and `hasAccess`. Takes an optional polling setting (6.5.5) | key `['subscription']` |
| useStartCheckout | `src/hooks/billing/` | Mutation, EP-13 | Get `checkoutUrl` | none (the page navigates away) |
| useCancelSubscription | `src/hooks/billing/` | Mutation, EP-16 | Cancel | invalidates `['subscription']` |
| usePayments | `src/hooks/billing/` | Query, EP-17 | Payment history | key `['payments']` |
| useGitHubConnection | `src/hooks/github/` | Query, EP-20 | Connection and repo | key `['github-connection']` |
| useGitHubConnect | `src/hooks/github/` | Mutation, EP-18 | Get `authorizeUrl` | none (the caller navigates) |
| useDisconnectGitHub | `src/hooks/github/` | Mutation, EP-21 | Disconnect | invalidates `['github-connection']` |
| useCreateRepo | `src/hooks/github/` | Mutation, EP-22 | Create the starter repo | invalidates `['github-connection']` |
| useCurrentTicket | `src/hooks/tickets/` | Query, EP-24 | Active ticket or `null` | key `['ticket','current']` |
| useTicket | `src/hooks/tickets/` | Query, EP-25 | One ticket with submission summaries | key `['ticket', id]` |
| useAssignTicket | `src/hooks/tickets/` | Mutation, EP-23 | Get the next ticket | invalidates `['ticket','current']`; seeds `['ticket', id]` |
| useStartTicket | `src/hooks/tickets/` | Mutation, EP-26 | `assigned` to `in_progress` | writes `['ticket', id]`; invalidates `['ticket','current']` |
| useAbandonTicket | `src/hooks/tickets/` | Mutation, EP-27 | Abandon and get a new ticket | invalidates `['ticket', id]` and `['ticket','current']`; seeds the new ticket if present |
| useMentorMessages | `src/hooks/mentor/` | Query, EP-29 | Transcript, oldest first | key `['mentor', id]` |
| useSendMentorMessage | `src/hooks/mentor/` | Mutation, EP-28 | Send a message | appends both returned messages to `['mentor', id]` |
| useSubmission | `src/hooks/submissions/` | Query, EP-31 | One attempt. Polls while `awaiting_ci` or `evaluating` (6.5.5). The diff is requested separately, on demand | key `['submission', id, attempt, includeDiff]` |
| useSubmitWork | `src/hooks/submissions/` | Mutation, EP-30 | Submit or resubmit | invalidates `['ticket', id]` and `['ticket','current']`; starts polling |
| useRetrySubmission | `src/hooks/submissions/` | Mutation, EP-32 | Retry a failed review | invalidates the submission and `['ticket', id]`; resumes polling |
| useExperienceProfile | `src/hooks/profile/` | Query, EP-34 | Completed tickets | key `['profile']` |
| useSetupProgress | `src/hooks/` | Derived from `useSubscription`, `useGitHubConnection`, `useCurrentTicket` | The four dashboard steps and which is next | none |
| useUnsavedChangesWarning | `src/hooks/` | Router blocker + `beforeunload` | Confirm before leaving a dirty form (6.5.6) | none |
| useDocumentTitle | `src/hooks/` | `document.title` | Sets "{Page} · Work Simulator" on every page | none |

---

## 6.5 Cross-Cutting Behavior

Rules that apply to more than one page. Page blocks in 6.2 refer to these.

### 6.5.1 Navigation and redirect rules

| Situation | Behavior |
|---|---|
| Logged-out user opens a protected route or deep link (for example `/tickets/abc`) | Redirect to `/login?from=<original path and query>` |
| Login succeeds | Navigate with `replace` to `from` if it is a safe path, otherwise `/dashboard`. A safe path starts with a single `/`, does not start with `//`, and is not `/login` or `/register`. Anything else is ignored (prevents open redirects) |
| Logged-in user opens `/login`, `/register` or `/forgot-password` | Redirect to `/dashboard` with `replace` |
| Anyone opens `/reset-password` or `/verify-email` | Page renders in any login state |
| `/` | Logged in: `/dashboard`. Logged out: `/login`. There is no landing page in V1 (A-38) |
| Unknown route, including `/admin` | NotFoundPage (no admin routes exist) |
| `/tickets/:ticketId` does not exist or belongs to another user | In-page "Ticket not found" (EP-25 returns the same 404 for both) |
| Reset or verification link expired or used | Handled on PG-04 and PG-05 |
| Logout | `replace` to `/login`, query cache cleared, so Back does not show private data |
| Browser Back and Forward | Standard history. Tab switches on PG-10 and the removal of PG-09 result params use `replace`, so they do not add history entries |
| Links to GitHub (repo, branch, PR, CI run) | New tab, `rel="noopener noreferrer"` |
| Chapa checkout and GitHub authorize | Same-tab navigation, because both are redirect flows that come back to PG-08 and PG-09 |
| Breadcrumbs | None. No page is more than two levels deep |
| Page title and focus on every route change | Title becomes "{Page} · Work Simulator"; focus moves to the page's `<h1>` (6.5.8) |

### 6.5.2 Session handling

Doc 5 defines the endpoints. It does not define client behavior, so this is this doc's design (A-40).

- **First load:** call EP-11. While it is pending, show `FullPageLoader` (the only full-page spinner in the app). If it returns 401, try a refresh (below), and if that also fails the user is logged out. This avoids flashing the login page for a user who has a valid refresh cookie.
- **A 401 on any request:** call EP-03 once, shared by every request that failed at the same moment. If it succeeds, each failed request is retried once. If it fails, clear the query cache and go to `/login?from=…` with the notice "Your session expired. Log in again." Only one redirect happens no matter how many requests failed.
- **Excluded from refresh-on-401:** EP-01, EP-02, EP-03 and the public token endpoints EP-06 to EP-09. On EP-02, a 401 means wrong credentials, not an expired session.
- **Token expiry while the user is active:** handled by the refresh above, so the user normally never notices. If the refresh itself fails, the redirect happens, and unsent form values and any unsent mentor text are lost. That is accepted for V1 (A-53).
- **Logout (EP-04) and log out of all devices (EP-05):** on success, clear the cache and go to `/login`. On a network or server failure, stay logged in and show "Couldn't log out. Try again.", because the cookie may still be valid. A 401 means there is already no session, so treat it as logged out.
- **Other tabs:** not synchronized in V1. A tab that was logged out elsewhere finds out on its next request.
- **Cookies:** every request is sent with credentials. If the frontend and API end up on different sites on EthioDeploy, the built cookie's `SameSite` setting decides whether login works at all (Q-12), so settle that before the demo.

### 6.5.3 API client and error handling

One shared client (proposed `src/lib/api/`) sends every request, unwraps the doc 5 envelope, and throws an `ApiError` with `status` and `message` when `success` is `false`. A response that is not in the envelope shape (for example an HTML 502 or 503 from a proxy) becomes a generic network-style error.

| Status | Doc 5 meaning | Frontend behavior |
|---|---|---|
| 400 | Validation failure or malformed token | Show the server message in the form (`errors.root`, or a field per A-41). Never triggers refresh or logout |
| 401 | Session problem (or wrong credentials on EP-02) | Session flow (6.5.2) |
| 402 | Paid access required | Message "An active subscription is required" with a link to PG-07. Refetch `['subscription']` so actions become disabled |
| 403 | GitHub not connected, or token no longer valid | Show the server message and a "Reconnect GitHub" link to PG-09. Refetch `['github-connection']` |
| 404 | Not found, or not owned | "Not found" state. Same text either way |
| 409 | Wrong state or conflict | Show the server message and refetch the affected resource (the screen was stale) |
| 410 | Link expired or already used | Show the server message and offer a new link (PG-04, PG-05) |
| 429 | Rate limited | Show the server message. Keep the form values. No automatic retry |
| 502 | Upstream failure (Chapa, GitHub, Gemini, Groq) | Show the server message and a user-started Retry button |
| Network error, timeout, non-envelope 5xx | — | "Can't reach the server. Check your connection and try again." with Retry |

Rules:
- Server `message` text is shown as returned for 4xx and 502. Doc 5 wrote those messages for users.
- Queries retry once on a network error or 5xx and never on a 4xx. **Mutations never retry automatically**, because a retry could duplicate a submission, a checkout, or a ticket.
- Timeouts: 30 s by default and 60 s for EP-22, EP-23, EP-27, EP-28 and EP-30, which call GitHub or Gemini (A-42). After a timeout on a mutation, the UI refetches the affected resource before it enables Retry, since the server may have finished the work anyway.
- The status-to-behavior mapping and the two field mappings from A-41 live in one file (proposed `src/lib/api/errors.ts`), so a changed message in doc 5 touches one place.
- Offline: there is no offline mode. A failed request shows the network error above. Requests are not queued.

### 6.5.4 Loading, empty and error patterns

| Pattern | Where it is used |
|---|---|
| Full-page spinner | Only `FullPageLoader` during session restore on first load |
| Skeleton | First load of a page's data (dashboard cards, billing cards, ticket header and tabs, profile cards, settings cards) |
| Inline status panel | Submission processing (PG-10) and payment confirmation (PG-08) |
| Button spinner | Any mutation. The button is disabled and its label changes ("Saving…") |
| Background refetch | No indicator. The old data stays on screen until the new data arrives |
| Optimistic UI | Not used for anything that changes server state. The one exception is the pending mentor message in PG-10, which is local only and rolls back to a "not sent, retry" marker on failure |

Empty states, each with an explanation and a next action where one exists:

| Collection | Text | Next action |
|---|---|---|
| Payment history (PG-07) | "No payments yet." | none |
| Experience profile (PG-11) | "No completed tickets yet. Finish your first ticket and it will appear here." | Go to dashboard |
| Mentor transcript (PG-10) | The mentor introduction in PG-10 | the composer itself |
| Submissions tab with none (PG-10) | "No submissions yet. Push your work to `{branchName}`, then submit." | Submit (if in progress) |
| Dashboard with no ticket (PG-06) | The setup checklist, or the "get your next ticket" prompt | the highlighted step |

A query that fails shows `ErrorState` (message plus Retry) **inside its own card or section**, so one failure never blanks the page.

### 6.5.5 Polling

The client polls; there are no WebSockets or server push in V1 (doc 5).

| What | Endpoint | Interval | Stops when | Limit |
|---|---|---|---|---|
| Checkout confirmation (PG-08) | EP-15 | every 2 s | `status` is `active` and `hasAccess` is `true` | 60 s, then the "not confirmed yet" view |
| Submission in progress (PG-10) | EP-31 without the diff | every 3 s for the first 2 minutes, then every 10 s | `status` is `completed` or `failed` | At 2 min a "taking longer than usual" hint appears. At 10 min automatic polling stops and a "Check again" button appears |

Polling pauses while the browser tab is hidden and refetches immediately when it becomes visible again. If a user returns later to a ticket whose latest submission is still in flight, polling starts again on its own. Interval values are constants in one config file (A-42). Window-focus refetch stays on for `['subscription']`, `['ticket', …]` and `['github-connection']`. Diff queries are fetched once and kept, because a completed submission's diff does not change.

### 6.5.6 Forms and unsaved changes

Applies to every form (PG-01 – PG-05, PG-09, PG-12) and to the mentor composer where noted.

- Built with react-hook-form and a Zod schema that mirrors doc 5's request rules. Validation runs on submit, then on change after the first submit.
- Submitting: the button is disabled and shows a spinner while the request runs (`SubmitButton`), so a double click or a second Enter cannot send twice. Enter submits.
- Invalid submit: focus moves to the first invalid field. Each field's message is linked with `aria-describedby`. `errors.root` renders with `role="alert"`.
- Server errors: shown in `errors.root`, except the two field cases in A-41. Doc 5's error envelope carries one message string, not a per-field list, so the frontend cannot place other server errors on fields.
- Inputs use the right `type` and `autocomplete` (`email`, `name`, `current-password`, `new-password`), so password managers and mobile keyboards behave. Passwords have a show/hide toggle, are never prefilled, and are never written to logs.
- **Unsaved changes:** only PG-12's two forms are guarded (through `useUnsavedChangesWarning`). While either is dirty, in-app navigation shows a confirmation ("You have unsaved changes." with "Leave" and "Stay"), and closing or refreshing the tab triggers the browser's own prompt. The guard is cleared right after a successful save. Login, register, forgot-password and reset-password are short and hold no user work, so they do not warn. The mentor composer does not warn on navigation. Its text survives a failed send but not a refresh or a session redirect (A-53).
- There is no auto-save and no draft restore in V1.

### 6.5.7 Responsive behavior

Breakpoints are Tailwind's defaults (A-52). The design is mobile-first and checked at 375 px, 768 px and 1280 px wide.

| Area | Below `md` (768 px) | `md` and up |
|---|---|---|
| Navigation | Menu button opens a Sheet holding every link | Top bar with Dashboard, Ticket (only while a current ticket exists) and Profile, plus a user menu (GitHub, Billing, Settings, Log out) |
| Forms | Single column, full width | Single column, centered, `max-w-md` |
| Payment history | One card per payment | Table |
| Ticket workspace | Tabs at full width | Tabs, content column capped at a readable width (`max-w-3xl`) |
| Diff viewer | Scrolls horizontally inside its own container | Same. The page body never scrolls sideways |
| Dialogs | Fit inside the viewport; content scrolls if it must | Standard centered dialog |
| Touch targets | Buttons, links in nav, tabs and inputs are at least 44 × 44 CSS px, set with classes where they are used (not by editing `components/ui/`) | Standard sizes |

Text is sized in `rem`, and pages must stay usable at 200% browser zoom. Long repo and branch names wrap (`break-all`). Not in V1: bottom navigation, swipe gestures, pull-to-refresh, camera or file pickers (there are no uploads).

### 6.5.8 Accessibility

Target: WCAG 2.1 AA (A-51). Verified by a manual keyboard pass and a screen-reader spot check of every page before the demo, matching doc 2's "manual spot-check".

- Every page has landmarks (`header`, `nav`, `main`), exactly one `<h1>`, and a "Skip to main content" link as the first focusable element in AppLayout.
- On every route change the document title updates (`useDocumentTitle`) and focus moves to the `<h1>` (`tabIndex={-1}`), so screen-reader users hear the new page.
- Every field has a visible `<Label>`. Errors are tied to fields with `aria-describedby`. Form-level errors use `role="alert"`.
- Live regions: the mentor message list (`aria-live="polite"`), submission and payment status panels (`role="status"`), and toasts (Sonner's live region) announce changes without stealing focus.
- Status is never conveyed by color alone. `StatusBadge` always carries text, and the diff viewer marks lines with `+` and `-` characters.
- Dialogs use Radix `AlertDialog`, which traps focus, closes on Esc, locks page scroll and returns focus to the trigger. When the trigger disappears after the action (for example "Abandon ticket"), focus moves to the page `<h1>`.
- Everything is reachable and usable by keyboard. Tabs use Radix Tabs (arrow keys). There are no custom shortcuts in V1; Esc (dialogs) and Enter (forms) work natively.
- Text contrast is at least 4.5:1, using the shadcn default theme (to be checked, not assumed). Non-essential motion is wrapped in `motion-reduce:` variants.
- Icons are decorative (`aria-hidden`) unless they are the only content of a control, in which case the control has an accessible name. Links that open a new tab say so in screen-reader-only text.
- There are no user-uploaded images in V1, so alt-text rules do not apply yet.

### 6.5.9 Security-related UI rules

- The frontend never sees, stores or sends a token by hand. The httpOnly cookies do it. Nothing is stored in `localStorage`, `sessionStorage` or IndexedDB (A-53).
- All API text (mentor replies, feedback, `failureReason`, diffs) is rendered as text. `dangerouslySetInnerHTML` is not used anywhere (A-46).
- No page contains card fields. Payment happens only on Chapa's hosted page (FR-17).
- The verification and reset pages contain no external links, scripts or images, so the token in the URL cannot leak through a referrer.
- The `from` redirect target is validated as a relative path (6.5.1).
- Hiding or disabling a button is a convenience, not authorization. The backend enforces access with 401, 402, 403 and 404 on every call, and the frontend handles those responses (6.5.3).
- Messages that doc 5 deliberately keeps identical (EP-07, EP-08) are shown verbatim. The UI adds nothing that reveals whether an account exists.
- Passwords, tokens and form values are never written to the console or any analytics tool.
- Cookie `SameSite` and any CSRF header for cookie-authenticated POSTs are open (Q-12). If the team adds a CSRF header, it is added in the API client only.

### 6.5.10 Destructive and irreversible actions

Each one uses `ConfirmDialog`. Esc and Cancel close it (unless the request is running); clicking outside does not. A failure stays inside the dialog with the confirm button enabled again. The exact dialog text is in the page block.

| Action | Page | What it does | Reversible? |
|---|---|---|---|
| Cancel subscription | PG-07 | Stops future charges. Access continues to `currentPeriodEnd` | The user can subscribe again once access ends (A-48) |
| Disconnect GitHub | PG-09 | Removes the stored connection. Records are kept. The grant at GitHub is not revoked (A-32) | Yes, by reconnecting |
| Abandon ticket | PG-10 | Resets the ticket and issues a new one. Mentor history and branch are kept | No |
| Resubmit for final score | PG-10 | Produces the final score, and the ticket cannot be revised after | No |
| Log out of all devices | PG-12 | Revokes every refresh token | Yes, by logging in again |

The words "Delete", "Archive" and "Deactivate" do not appear in the V1 UI, because no such action exists (FR-14). Logging out of this device has no confirmation, because it is fully reversible.

### 6.5.11 State categories

| Kind of state | Held in | V1 contents |
|---|---|---|
| Server state | TanStack Query | `['me']`, `['subscription']`, `['payments']`, `['github-connection']`, `['ticket','current']`, `['ticket', id]`, `['mentor', id]`, `['submission', id, attempt, includeDiff]`, `['profile']` |
| Form state | react-hook-form | Values, errors, dirty and submitting flags for every form |
| URL state | Query string | `?token=` (PG-04, PG-05), `?github=` and `&reason=` (PG-09), `?tab=` (PG-10), `?from=` (PG-02) |
| Router state | Navigation state | The one-time login notices (6.2, PG-02) |
| Component state | React state | Dialog open, nav sheet open, diff section open, resend cooldown, pending mentor message, "show full feedback" |
| Persistent state | none | None in V1. No theme, language or draft is stored (A-53) |

---

## 6.6 Checklist Coverage: What Applies to V1

The supplied 42-topic frontend checklist, checked against what docs 2 and 5 actually require. "Not built" means no requirement exists yet. An FR would have to be added to doc 2 before it enters V1.

| Topic | V1 treatment |
|---|---|
| Screen states (initial, loading, skeleton, empty, error, not found, expired session) | Defined per page in 6.2 and in 6.5.2 – 6.5.4 |
| Maintenance page, a dedicated permission-denied page, offline mode | Not built. Permission problems show as per-action 402/403 handling (6.5.3). Network failures show the generic error |
| Navigation, redirects, deep links, 404 | 6.5.1 |
| Auth UX: login, register, logout, logout-all, forgot and reset password, change password, email verification and resend, session expiry, token refresh, session restore | In: PG-01 – PG-05, PG-12, 6.5.2 |
| Auth UX: MFA and recovery, account locked or disabled screens, remember me, OAuth login | Not in V1 (doc 2, 2.3). GitHub OAuth is for repo access only. OAuth cancellation as its own state: Q-16 |
| Forms, validation, unsaved changes | 6.5.6 |
| Button and action states | Pending state through `SubmitButton`; per-action states are listed in each page block |
| Confirmation and destructive actions | 6.5.10 |
| Modals | `ConfirmDialog` only |
| Responsive design and mobile UX | 6.5.7. No swipe, pull-to-refresh, bottom navigation or camera |
| Accessibility and keyboard UX | 6.5.8. No custom keyboard shortcuts in V1 |
| Search, filters, sorting, pagination, tables with column and bulk features, export | Not in V1 (doc 2, 2.3). Payment history is a short list, newest first |
| File upload and image UX | Not in V1 (no user uploads, doc 2, 2.3) |
| Notifications and feedback | Toasts for short results only. No in-app notification inbox. Asynchronous product notifications are deferred (doc 2, 2.3) |
| Settings | Name, password and log out of all devices only. Theme, language, notification and privacy preferences, device list and API keys: not in V1 |
| Theme and design system | shadcn default tokens used as they are. No dark-mode or custom-theme requirement exists |
| Performance budgets and Core Web Vitals | No frontend budget in docs 2 or 5, and none is invented here. Doc 2's timing targets (mentor about 3 s, evaluator under 30 s at p95) are backend targets. The UI shows progress while waiting |
| Offline, slow network, PWA | Not built. Slow or failed requests follow 6.5.3 |
| Optimistic UI | Not used, except the pending mentor message (6.5.4) |
| Real-time features | Polling only (6.5.5) |
| Concurrency, multi-tab, stale data | A 409 refetches the affected resource (6.5.3). No cross-tab sync |
| Browser compatibility | A-54 |
| Internationalization (RTL, Amharic, Ethiopian calendar) | Not in V1 (doc 2, 2.3). English only, fixed date style (A-49) |
| Security UX | 6.5.9 |
| Analytics and SEO | Not built. No requirement in docs 2 or 5 |
| Content management and admin | Not in V1 (doc 2, 2.3) |
| Onboarding | The dashboard setup checklist (PG-06) only. No product tour |
| Help and support | No help center, FAQ or feedback form. Support contact is open (Q-18) |
| Frontend architecture | Folder and file proposals are in 6.3 and 6.4. Doc 7 confirms them |
| Testing | Outside this doc. The state lists in 6.2 are written so each line can become a test case |

---

## 6.7 Assumptions

Numbering continues from doc 5 (A-01 to A-34). Correct any that are wrong before doc 7 is written.

| ID | Assumption | Where it matters |
|---|---|---|
| A-35 | Doc 3 (use cases) was not available, so `Linked Use Case` uses the same descriptive placeholders as docs 2 and 5. Replace them with real `UC-##` IDs when doc 3 exists. This continues A-21 of doc 5 | 6.1, all pages |
| A-36 | The frontend stack is what the template implies: React + TypeScript, shadcn/ui on Radix with Tailwind, react-hook-form with Zod, TanStack Query. Only Card, Input and Button are confirmed to exist. The router library is not named in any doc, so this doc describes routing behavior only. All file paths are proposals until doc 7 | 6.2 – 6.4 |
| A-37 | Route paths are this doc's choice. Four things outside the frontend must match them: the verification email links to `/verify-email?token=…`; the reset email links to `/reset-password?token=…`; Chapa's `return_url` is `{frontend}/billing/return`; the GitHub callback redirects to `/github` (doc 5 left these last two to this doc). Chapa may add its own query parameters to the return URL, and the page ignores them | PG-04, PG-05, PG-08, PG-09 |
| A-38 | There is no landing or marketing page in V1. Nothing in doc 2 asks for one. `/` redirects | 6.5.1 |
| A-39 | Email verification blocks nothing in the UI. Unverified users can do everything the API allows and see a banner. If Q-04 decides an action needs verification, a gate would be added | PG-02, EmailVerificationBanner |
| A-40 | Client session handling (restore through EP-11, one shared refresh on 401, the exclusions, the logout behavior) is designed in 6.5.2. Doc 5 defines the endpoints only | 6.5.2 |
| A-41 | Server errors carry one message string and no field (A-19), so they show in `errors.root`. Exactly two are placed on fields: EP-01 409 goes to `email`; EP-10 400 with the exact message "Current password is incorrect" goes to `currentPassword`. The second depends on that text staying the same, and the mapping lives in one file | all forms, 6.5.3 |
| A-42 | These timing values are this doc's choices, not from docs 2 or 5, and are constants in one config file to tune after testing: checkout poll every 2 s for 60 s; submission poll every 3 s, then every 10 s after 2 minutes, hint at 2 minutes, auto-stop at 10 minutes; verification-resend cooldown 60 s; request timeout 30 s (60 s for EP-22, EP-23, EP-27, EP-28, EP-30); queries retry once, mutations never retry | 6.5.3, 6.5.5 |
| A-43 | The phase shown on a ticket comes from `ticket.status` plus the latest submission's `status` (table in PG-10). The mentor composer is disabled in `submitted_v1` and `resubmitted` because EP-28 rejects messages then (Q-10c). If that is reversed, only that table changes | PG-10 |
| A-44 | GitHub links are built from `repo.fullName` and `branchName` on `github.com` (no GitHub Enterprise) | PG-09, PG-10 |
| A-45 | The repo-name pattern `^[A-Za-z0-9._-]{1,100}$` (and not `.` or `..`) is a client-side check based on GitHub's naming rules. Doc 5 says only "string, optional". The server stays authoritative | PG-09 |
| A-46 | Mentor replies, feedback, `failureReason` and diffs are rendered as plain text with whitespace kept, never as HTML, and without Markdown. The docs do not say whether the models return Markdown (Q-17). Diffs have no syntax highlighting | PG-10, PG-11 |
| A-47 | The maximum mentor message length is not set (Q-10b). Until it is, the composer shows no character counter and relies on the server's 400 message | PG-10 |
| A-48 | "Next billing date" (FR-20) is `currentPeriodEnd`, because the API has no separate field. For a canceled subscription the same value is labeled "Access ends". "Subscribe" is offered only when `hasAccess` is `false`, and never for `past_due` (Q-15). This avoids starting a checkout while a canceled subscription still has paid time, a case doc 5 does not define for EP-14 | PG-07 |
| A-49 | Dates show in English in the browser's timezone (for example "19 Sep 2026"). Amounts show as returned (`amount` string plus `currency`). There is no localization (doc 2, 2.3) | PG-07, PG-10, PG-11 |
| A-50 | Category and difficulty are free strings whose values are unknown, so they are shown as given, with no per-value colors or icons | PG-06, PG-10, PG-11 |
| A-51 | The accessibility target is WCAG 2.1 AA, checked manually. Doc 2 only says elements are keyboard-navigable through Radix and spot-checked. Naming a WCAG level is this doc's extension | 6.5.8 |
| A-52 | Breakpoints are Tailwind's defaults. `md` (768 px) is the main switch between phone and larger layouts | 6.5.7 |
| A-53 | Nothing is stored in the browser (no `localStorage`, `sessionStorage` or IndexedDB). A page refresh or a session redirect therefore loses unsent mentor text and unsaved settings edits. The small amount of state that must survive a refresh lives in the URL | 6.5.6, 6.5.9 |
| A-54 | Supported browsers are the current stable Chrome, Edge, Firefox, Safari (macOS and iOS) and Chrome on Android. No unsupported-browser page is built | all |

---

## 6.8 Open Questions

Numbering continues from doc 5 (Q-01 to Q-13). Q-03 to Q-13 from docs 4 and 5 are still open, and several affect this doc: Q-04 (verification gating), Q-05 and Q-07 (renewals and grace period), Q-08 (GitHub scope wording), Q-10 (mentor limits and revision-phase access), Q-11 (sessions after a password change), Q-12 (cookie `SameSite`), Q-13 (submission timeouts).

| ID | Question | Affects |
|---|---|---|
| Q-14 | **Where does the price come from?** No endpoint returns it (EP-13 reads price and currency from server config), so the Subscribe UI cannot show one. Options: add `price` and `currency` to EP-15 or a new endpoint; copy the value into a frontend environment variable (can drift from the server); or show none and rely on Chapa's page. Interim: no price is shown before checkout | PG-07, EP-13, EP-15 |
| Q-15 | **A `past_due` user has no way to pay again.** EP-13 returns 409 for `past_due`, and by Q-07 `past_due` effectively means access ends. A failed renewal can therefore leave a user locked out with no in-app fix. Should EP-13 accept `past_due` users, or is this handled by hand through the Chapa dashboard (and should the UI say so)? Interim: the card shows the failure and no button | PG-07, EP-13, Q-05, Q-07 |
| Q-16 | **What does EP-19 do when the user cancels GitHub authorization?** GitHub sends the browser back with an error, and EP-19's `reason` values (`state_invalid`, `scope_invalid`, `exchange_failed`) have none for it. Should `access_denied` be added? Interim: the UI shows the generic text | PG-09, EP-19 |
| Q-17 | **Do Gemini's and Groq's outputs use Markdown that the team wants rendered** (code blocks especially)? It needs a sanitizing Markdown renderer as a new dependency. Interim: plain text | PG-10, PG-11 |
| Q-18 | **Is there any support contact for V1?** Refunds are manual (FR-24) and Q-15 shows cases a user cannot fix alone, but no doc names a place to send them. Interim: the UI never says "contact support"; it says to try again | PG-07, 6.5.3 |

---

## 6.9 Changes to Earlier Docs

Numbering is not changed. These are amendments.

**Doc 5:**
- **EP-13 and EP-19.** The two pages doc 5 left to this doc are now defined: Chapa's `return_url` is `/billing/return` (PG-08) and the GitHub callback landing page is `/github` (PG-09), A-37.
- **EP-06 and EP-09.** The emailed links must point to `/verify-email?token=…` and `/reset-password?token=…` (A-37). The backend email templates need to match.
- **Q-14, Q-15, Q-16.** Each may need an API change if answered yes (EP-15 or a new endpoint; EP-13; EP-19). Nothing is changed in doc 5 by this doc.

**Doc 2:**
- **Accessibility NFR.** WCAG 2.1 AA is named as the target (A-51). This extends the row, and the "manual spot-check" verification stays as it is.
- **FR-37.** Applied literally in the UI, as in doc 5 (Q-10c).
- No FR is added, removed or renumbered.

No locked decision is changed.

---

*Numbering convention: FR-01, FR-02... (doc 2), `UC-##` (doc 3), `DR-##`, `A-##` and `Q-##` (docs 4, 5 and this doc), `EP-##` (doc 5) and `PG-##` (this doc) each form one continuous sequence across the whole series. Never renumber once used. If a page is dropped, mark it `~~PG-XX~~ (deprecated, see PG-YY)` instead.*

Next: proceed to → [7. Folder & File Structure]
