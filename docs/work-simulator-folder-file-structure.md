# 7. Folder & File Structure

*Project: Work Simulator · Links back to: [6. Frontend --- UI, Pages &
Components](./work-simulator-frontend-ui.md) · This is the literal
project-added/changed file list that implementation and PR review should
check against. Files inherited from the existing backend/frontend
templates are not repeated here.*

This document defines the files Work Simulator adds or changes for V1.
It is based on docs 2, 4, 5 and 6, and aligns backend file names with
[8. Function-Level Spec — Backend](./work-simulator-function-level-spec-backend.md)
and the Doc 10 frontend shared modules. Doc 3 (Use Cases) is not required to
produce this file because docs 2, 4, 5 and 6 already provide the FR,
entity, endpoint, page, component and hook references needed for the
structure.

**Important source boundary:** the supplied docs do not include the
literal `template-node-express` and `template-react` directory trees.
Therefore this document does **not** claim to reproduce the inherited
template files. It lists project additions/changes and marks
generated/configuration artifacts where their exact generated name is
not settled by the source docs.

**Locked V1 exclusions:** no Voxide files (V2 mandated external — see doc 1 §1.5; ~~FR-53~~ deferred), no admin
files, no account-deletion files, no upload files, no public-profile
files, no search/filter/bulk-operation files, no localization files, no
self-service refund files, and no separate notification subsystem.
Django **is** in V1 (starter template + ticket-templates).

------------------------------------------------------------------------

## 7.1 Repository-Level Changes

``` text
/
├── backend/
├── frontend/
├── docs/
├── .husky/                         # existing; unchanged unless CI/quality rules require it
└── <existing root package/CI files> # inherited/existing; not repeated
```

### 7.1.1 Documentation

``` text
docs/
├── work-simulator-problem-solution-v2.md          # Doc 1
├── work-simulator-requirements.md                 # Doc 2
├── work-simulator-use-cases.md                    # Doc 3
├── work-simulator-database.md                     # Doc 4
├── work-simulator-api-spec.md                     # Doc 5
├── work-simulator-frontend-ui.md                  # Doc 6
├── work-simulator-folder-file-structure.md        # this Doc 7
├── work-simulator-function-level-spec-backend.md  # Doc 8
├── work-simulator-test-plan-backend.md            # Doc 9
├── work-simulator-function-level-spec-frontend.md # Doc 10
├── work-simulator-test-plan-frontend.md           # Doc 11
└── decisions-log.md                               # optional; not part of the numbered series
```

These are the real filenames in the series. Backend function-level spec is
doc 8; backend test plan is doc 9; frontend function-level spec is doc 10;
frontend test plan is doc 11.

------------------------------------------------------------------------

## 7.2 Backend --- New Files

The backend already has Node/Express 5, TypeScript, Prisma/PostgreSQL,
the built `User`/`RefreshToken` models, cookie authentication, rotation,
`authLimiter`, Pino request IDs, and the existing authentication
foundation. Those inherited files are not redesigned here.

The new backend implementation is grouped by the domains already
established by Doc 5.

### 7.2.1 Backend Routes

``` text
backend/src/routes/
├── user.routes.ts
├── subscription.routes.ts
├── payment.routes.ts
├── github.routes.ts
├── ticket.routes.ts
├── mentor.routes.ts
├── submission.routes.ts
├── profile.routes.ts
└── webhook.routes.ts
```

**Endpoint ownership**

  File                       Endpoints
  -------------------------- -----------------------------------
  `user.routes.ts`           EP-11, EP-12
  `subscription.routes.ts`   EP-13, EP-15, EP-16
  `payment.routes.ts`        EP-17
  `github.routes.ts`         EP-18, EP-19, EP-20, EP-21, EP-22
  `ticket.routes.ts`         EP-23, EP-24, EP-25, EP-26, EP-27
  `mentor.routes.ts`         EP-28, EP-29
  `submission.routes.ts`     EP-30, EP-31, EP-32
  `profile.routes.ts`        EP-34
  `webhook.routes.ts`        EP-14, EP-33

The already-built authentication routes remain in the existing auth
route/controller structure and are not duplicated here. EP-01 through
EP-10 are therefore **existing/changed**, not a new route family.

### 7.2.2 Backend Controllers

``` text
backend/src/controllers/
├── user.controller.ts
├── subscription.controller.ts
├── payment.controller.ts
├── github.controller.ts
├── ticket.controller.ts
├── mentor.controller.ts
├── submission.controller.ts
├── profile.controller.ts
└── webhooks/
    ├── chapa.controller.ts
    └── github.controller.ts
```

Controller responsibilities follow the endpoint groups above.
Controllers own HTTP concerns: request validation input, authorization
context, status codes, response envelope, and delegation to services.
`payment.controller.ts` remains a thin file for EP-17.
Webhook controllers share `webhook.routes.ts` (EP-14 → Chapa; EP-33 →
GitHub).

### 7.2.3 Backend Services

``` text
backend/src/services/
├── user.service.ts
├── email-verification.service.ts
├── password-reset.service.ts
├── email.service.ts
├── chapa.service.ts
├── subscription.service.ts
├── subscription-renewal.service.ts
├── github.service.ts
├── ticket.service.ts
├── ticket-generation.service.ts
├── mentor.service.ts
├── submission.service.ts
├── github-webhook.service.ts
├── evaluation.service.ts
└── profile.service.ts
```

Responsibilities:

-   `user.service.ts` --- current-user lookup and display-name update.
-   `email-verification.service.ts` --- verification-token
    creation/consumption and resend behavior.
-   `password-reset.service.ts` --- reset-token creation/consumption and
    password reset.
-   `email.service.ts` --- transactional email sending used by
    verification, reset, and payment-failure flows.
-   `chapa.service.ts` --- hosted checkout and Chapa-side
    subscription/payment operations.
-   `subscription.service.ts` --- subscription state, access-window
    calculations, cancellation, renewal-period updates, and
    `processChapaWebhook` (EP-14).
-   `subscription-renewal.service.ts` --- scheduled upcoming-renewal
    reminders and period-end charges (doc 5 §5.7 / D-08).
-   `github.service.ts` --- OAuth exchange, scope checks, encrypted
    token persistence, repository creation, branch/PR/diff access, and
    GitHub error mapping.
-   `ticket.service.ts` --- assignment, state transitions, branch
    creation coordination, abandonment, and active-ticket rules.
-   `ticket-generation.service.ts` --- loads team-authored template files
    and asks Gemini to fill the specific scenario wording without
    inventing the template structure.
-   `mentor.service.ts` --- progressive-hint mentor conversation and
    per-ticket rate-limit enforcement.
-   `submission.service.ts` --- attempt selection, PR reuse/creation,
    diff capture, submission persistence, and retry behavior.
-   `github-webhook.service.ts` --- GitHub webhook signature verification
    and `workflow_run` processing (EP-33); hands off to evaluation.
-   `evaluation.service.ts` --- Groq evaluation, transcript inclusion,
    first-pass feedback, final rubric scoring, and weighted total.
-   `profile.service.ts` --- completed-ticket practice-record
    projection.

There is no combined `webhook.service.ts` and no `github-ci.service.ts`.
Chapa webhook processing lives in `subscription.service.ts`; GitHub CI
webhook processing lives in `github-webhook.service.ts`.

### 7.2.4 Backend Validation Schemas

``` text
backend/src/validators/
├── user.validators.ts
├── github.validators.ts
├── ticket.validators.ts
├── mentor.validators.ts
└── submission.validators.ts
```

These correspond only to request bodies/query parameters that Doc 5
specifies as application validation concerns. Validation continues to
use the existing `validate.middleware`.

Required validations include:

-   registration/profile name: trimmed, minimum 2 characters;
-   password creation/reset/change: minimum 8 characters;
-   email fields: valid email format;
-   repository template: `react | node_express | django`;
-   repository name: optional/defaulted according to EP-22;
-   mentor content: non-empty and bounded by the implementation limit
    from Q-10;
-   submission attempt: server-derived, never selected by the client;
-   submission polling attempt: only `1` or `2`;
-   webhook payload: required transaction reference/payment outcome
    before processing.

### 7.2.5 Backend Integrations

``` text
backend/src/integrations/
├── chapa.ts
├── github.ts
├── gemini.ts
└── groq.ts
```

These isolate external API calls from application services (flat files,
aligned with doc 8).

No `voxide` integration is created. Voxide is a V2 mandated external
integration (doc 1 §1.5); ~~FR-53~~ is deferred — no V1 files.

### 7.2.6 Backend Serializers

``` text
backend/src/serializers/
├── user.serializer.ts
├── subscription.serializer.ts
├── payment.serializer.ts
├── repo.serializer.ts
├── ticket.serializer.ts
├── submission.serializer.ts
├── evaluation.serializer.ts
└── mentor-message.serializer.ts
```

One serializer per shared response shape in doc 5 §5.3.0. Controllers
and services use these to produce API objects (including Evaluation
field renames from DB columns).

### 7.2.7 Backend Security/Crypto Helpers

``` text
backend/src/lib/
├── crypto/
│   └── token-hash.ts
├── encryption/
│   └── github-token.ts
├── github/
│   └── oauth-state.ts
└── scoring/
    └── rubric.ts
```

Responsibilities:

-   `token-hash.ts` --- hashing/comparison for verification/reset tokens
    using the same security pattern required for stored refresh-token
    hashes.
-   `github-token.ts` --- encryption/decryption of the GitHub OAuth
    access token at rest.
-   `oauth-state.ts` --- signed, short-lived, user-bound GitHub OAuth
    state.
-   `rubric.ts` --- the fixed `40 / 25 / 20 / 15` weights and
    weighted-total calculation.

The rubric weights are application constants, not database fields.

### 7.2.8 Ticket Template Files

Team-authored ticket structure is stored in code. The database stores
only `Ticket.templateKey` plus the generated ticket snapshot in
`Ticket.content`.

``` text
backend/src/ticket-templates/
├── index.ts
├── react/
│   └── <team-authored-react-ticket-template-files>
├── node-express/
│   └── <team-authored-node-express-ticket-template-files>
└── django/
    └── <team-authored-django-ticket-template-files>
```

The exact individual template filenames are **not specified by docs 2,
4, 5 or 6**, so they must be named when the team creates the actual
template set. They must not be invented in Doc 7.

The template loader must expose a stable key matching
`Ticket.templateKey`. `StarterTemplate` includes `react`,
`node_express`, and `django`.

### 7.2.9 Backend Webhook Handling

Webhook routes are explicitly separate from ordinary authenticated API
routes. Controllers live under `controllers/webhooks/`; processing lives
in domain services (not a combined `webhook.service.ts`).

``` text
backend/src/routes/webhook.routes.ts
backend/src/controllers/webhooks/
├── chapa.controller.ts      # EP-14
└── github.controller.ts     # EP-33
```

-   EP-14: `chapa.controller.ts` → signature verification +
    `subscription.service.ts` (`processChapaWebhook`) / Chapa helpers.
-   EP-33: `github.controller.ts` → `github-webhook.service.ts` +
    `evaluation.service.ts`.

The Chapa route must receive the raw body before the normal JSON parser
so signature verification can operate on the raw request body.

The GitHub workflow-run webhook must update the matching submission/CI
state and ignore events for commits with no submission, as specified in
Doc 5.

### 7.2.10 Backend Email Templates

``` text
backend/src/emails/
├── verification/
│   └── verification-email.*
├── password-reset/
│   └── password-reset-email.*
└── payment/
    └── payment-failed-email.*
```

The exact email rendering library and file extension are not settled by
the supplied docs, so the placeholder extension is intentional. The
required email behaviors are settled by FR-05--FR-08 and FR-22.

------------------------------------------------------------------------

## 7.3 Frontend --- New Files

The frontend template already supplies the base React/TypeScript/shadcn
foundation. Only project-specific additions are listed here.

### 7.3.1 Pages

``` text
frontend/src/pages/
├── auth/
│   ├── RegisterPage.tsx
│   ├── LoginPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   └── VerifyEmailPage.tsx
├── dashboard/
│   └── DashboardPage.tsx
├── billing/
│   ├── BillingPage.tsx
│   └── CheckoutReturnPage.tsx
├── github/
│   └── GitHubSetupPage.tsx
├── tickets/
│   └── TicketPage.tsx
├── profile/
│   └── ExperienceProfilePage.tsx
├── settings/
│   └── SettingsPage.tsx
└── NotFoundPage.tsx
```

This exactly follows the page inventory in Doc 6:

  ID      File
  ------- --------------------------------------------------------
  PG-01   `frontend/src/pages/auth/RegisterPage.tsx`
  PG-02   `frontend/src/pages/auth/LoginPage.tsx`
  PG-03   `frontend/src/pages/auth/ForgotPasswordPage.tsx`
  PG-04   `frontend/src/pages/auth/ResetPasswordPage.tsx`
  PG-05   `frontend/src/pages/auth/VerifyEmailPage.tsx`
  PG-06   `frontend/src/pages/dashboard/DashboardPage.tsx`
  PG-07   `frontend/src/pages/billing/BillingPage.tsx`
  PG-08   `frontend/src/pages/billing/CheckoutReturnPage.tsx`
  PG-09   `frontend/src/pages/github/GitHubSetupPage.tsx`
  PG-10   `frontend/src/pages/tickets/TicketPage.tsx`
  PG-11   `frontend/src/pages/profile/ExperienceProfilePage.tsx`
  PG-12   `frontend/src/pages/settings/SettingsPage.tsx`
  PG-13   `frontend/src/pages/NotFoundPage.tsx`

No V1 landing page is added. `/` redirects according to Doc 6.

### 7.3.2 Shared Layout and Routing Components

``` text
frontend/src/components/layout/
├── AuthLayout.tsx
├── AppLayout.tsx
├── FullPageLoader.tsx
├── EmailVerificationBanner.tsx
└── SubscriptionBanner.tsx

frontend/src/routes/
├── RequireAuth.tsx
├── PublicOnly.tsx
└── RootRedirect.tsx
```

### 7.3.3 Common Components

``` text
frontend/src/components/common/
├── PasswordInput.tsx
├── FormRootError.tsx
├── SubmitButton.tsx
├── ErrorState.tsx
├── EmptyState.tsx
├── StatusBadge.tsx
├── ConfirmDialog.tsx
├── ExternalLink.tsx
└── CopyButton.tsx
```

### 7.3.4 Billing Components

``` text
frontend/src/components/billing/
├── SubscriptionCard.tsx
└── PaymentHistory.tsx
```

### 7.3.5 GitHub Components

``` text
frontend/src/components/github/
├── GitHubConnectionCard.tsx
├── RepoCreateForm.tsx
└── RepoSummary.tsx
```

### 7.3.6 Dashboard Components

``` text
frontend/src/components/dashboard/
├── SetupChecklist.tsx
└── CurrentTicketCard.tsx
```

### 7.3.7 Ticket Components

``` text
frontend/src/components/ticket/
├── TicketHeader.tsx
├── TicketActionBar.tsx
├── TicketDetails.tsx
├── BranchInstructions.tsx
├── MentorPanel.tsx
├── MentorMessageList.tsx
├── MentorComposer.tsx
├── SubmissionsPanel.tsx
├── SubmissionCard.tsx
├── EvaluationView.tsx
├── ScoreBreakdown.tsx
└── DiffViewer.tsx
```

### 7.3.8 Profile Components

``` text
frontend/src/components/profile/
├── PracticeRecordNotice.tsx
└── ExperienceItem.tsx
```

### 7.3.9 Frontend Hooks

``` text
frontend/src/hooks/
├── useSetupProgress.ts
├── useUnsavedChangesWarning.ts
├── useDocumentTitle.ts
├── auth/
│   ├── useMe.ts
│   ├── useRegister.ts
│   ├── useLogin.ts
│   ├── useLogout.ts
│   ├── useLogoutAll.ts
│   ├── useVerifyEmail.ts
│   ├── useResendVerification.ts
│   ├── useForgotPassword.ts
│   ├── useResetPassword.ts
│   ├── useChangePassword.ts
│   └── useUpdateProfile.ts
├── billing/
│   ├── useSubscription.ts
│   ├── useStartCheckout.ts
│   ├── useCancelSubscription.ts
│   └── usePayments.ts
├── github/
│   ├── useGitHubConnection.ts
│   ├── useGitHubConnect.ts
│   ├── useDisconnectGitHub.ts
│   └── useCreateRepo.ts
├── tickets/
│   ├── useCurrentTicket.ts
│   ├── useTicket.ts
│   ├── useAssignTicket.ts
│   ├── useStartTicket.ts
│   └── useAbandonTicket.ts
├── mentor/
│   ├── useMentorMessages.ts
│   └── useSendMentorMessage.ts
├── submissions/
│   ├── useSubmission.ts
│   ├── useSubmitWork.ts
│   └── useRetrySubmission.ts
└── profile/
    └── useExperienceProfile.ts
```

### 7.3.10 Frontend API Client

``` text
frontend/src/lib/api/
├── client.ts
├── errors.ts
└── <domain endpoint modules if the existing template/client convention requires them>
```

`client.ts` is the one shared HTTP client. It:

-   sends credentials on every request;
-   unwraps `{ statusCode, success, message, data }`;
-   raises `ApiError` for `success: false`;
-   performs the shared 401 → EP-03 refresh behavior;
-   never stores access or refresh tokens;
-   never automatically retries mutations;
-   applies the timeout rules from Doc 6.

`errors.ts` owns the status/message-to-UI mapping described in Doc 6.

The exact split into additional endpoint modules is not specified by the
supplied docs, so no individual `users.ts`, `tickets.ts`, etc. file is
asserted as mandatory.

### 7.3.11 Frontend Configuration

``` text
frontend/src/config/
├── rubric.ts
└── app.config.ts
```

`rubric.ts` exposes the fixed four-category weights used by the UI:

-   requirements met --- 40%;
-   correctness & tests --- 25%;
-   code quality --- 20%;
-   problem-solving & communication --- 15%.

The UI must not calculate a different rubric.

`app.config.ts` holds frontend timing and app constants from Doc 6
(polling intervals, timeouts, resend cooldown, etc.).

### 7.3.12 Frontend Types, Lib Helpers and Schemas (Doc 10)

``` text
frontend/src/types/
└── api.ts

frontend/src/lib/
├── query-keys.ts
├── ticket-phase.ts
├── subscription-view.ts
├── navigation.ts
├── format.ts
└── github.ts

frontend/src/schemas/
├── auth.schemas.ts
└── github.schemas.ts
```

These align with Doc 10's proposed shared frontend modules: API types,
query-key factories, ticket-phase and subscription view helpers,
navigation/format/github utilities, and Zod schemas for auth and GitHub
forms.

------------------------------------------------------------------------

## 7.4 Schema / Config Changes

### 7.4.1 Prisma Schema

``` text
backend/prisma/
└── schema.prisma
```

`schema.prisma` is changed to add:

-   `User.name`
-   `User.emailVerifiedAt`
-   `EmailVerificationToken`
-   `PasswordResetToken`
-   `GitHubConnection`
-   `StarterRepo`
-   `Subscription`
-   `Payment`
-   `Ticket`
-   `MentorMessage`
-   `Submission`
-   `Evaluation`
-   `TicketStatus`
-   `SubscriptionStatus`
-   `PaymentStatus`
-   `StarterTemplate`
-   `SubmissionStatus`
-   `MentorMessageRole`

`User` and `RefreshToken` are not redesigned beyond the documented
additions/verification of their existing types.

### 7.4.2 Prisma Migration

``` text
backend/prisma/migrations/
└── <generated_timestamp>_work_simulator_v1/
    └── migration.sql
```

The migration must contain the additive schema changes and the
hand-written SQL required by Doc 4:

-   DR-01 partial unique active-ticket index;
-   DR-02 partial unique active/past-due subscription index;
-   DR-03 submission-attempt check;
-   DR-04 evaluation score checks.

The timestamp and migration directory name are generated by Prisma and
therefore are intentionally not invented here.

### 7.4.3 Backend Environment Configuration

The exact existing environment filename is not established by the
supplied docs. The following **new required configuration keys** must
exist in the backend's existing environment/config mechanism:

``` text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CHAPA_SECRET_KEY
CHAPA_WEBHOOK_SECRET
CHAPA_RETURN_URL
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_CALLBACK_URL
GITHUB_TOKEN_ENCRYPTION_KEY
GEMINI_API_KEY
GROQ_API_KEY
CLIENT_URL
```

Only add names that match the project's existing configuration
convention. The docs establish the integrations and secrets
conceptually; the CORS/client origin key is `CLIENT_URL` (not
`FRONTEND_URL`). `CHAPA_RETURN_URL` remains.

### 7.4.4 Starter Template Configuration

The codebase contains the three V1 starter templates:

``` text
React
Node/Express
Django
```

`StarterTemplate` enum values: `react`, `node_express`, `django`.

------------------------------------------------------------------------

## 7.5 API-to-File Ownership Map

This table is the implementation cross-check for Doc 5.

  -------------------------------------------------------------------------------------------------------------
  Endpoint          Route file                 Controller                     Main service
  ----------------- -------------------------- ------------------------------ ---------------------------------
  EP-01             existing auth route        existing auth controller       existing auth service

  EP-02             existing auth route        existing auth controller       existing auth service

  EP-03             existing auth route        existing auth controller       existing auth service

  EP-04             existing auth route        existing auth controller       existing auth service

  EP-05             existing auth route        existing auth controller       existing auth service

  EP-06             existing/new auth route    existing/new auth controller   `email-verification.service.ts`

  EP-07             existing/new auth route    existing/new auth controller   `email-verification.service.ts`

  EP-08             existing/new auth route    existing/new auth controller   `password-reset.service.ts`

  EP-09             existing/new auth route    existing/new auth controller   `password-reset.service.ts`

  EP-10             existing/new auth route    existing/new auth controller   existing auth/user service

  EP-11             `user.routes.ts`           `user.controller.ts`           `user.service.ts`

  EP-12             `user.routes.ts`           `user.controller.ts`           `user.service.ts`

  EP-13             `subscription.routes.ts`   `subscription.controller.ts`   `chapa.service.ts` +
                                                                              `subscription.service.ts`

  EP-14             `webhook.routes.ts`        `webhooks/chapa.controller.ts` `subscription.service.ts`
                                                                              (`processChapaWebhook`) +
                                                                              `chapa.service.ts`

  EP-15             `subscription.routes.ts`   `subscription.controller.ts`   `subscription.service.ts`

  EP-16             `subscription.routes.ts`   `subscription.controller.ts`   `subscription.service.ts` +
                                                                              `chapa.service.ts`

  EP-17             `payment.routes.ts`        `payment.controller.ts`        `subscription.service.ts` /
                                                                              payment query service logic

  EP-18             `github.routes.ts`         `github.controller.ts`         `github.service.ts`

  EP-19             `github.routes.ts`         `github.controller.ts`         `github.service.ts`

  EP-20             `github.routes.ts`         `github.controller.ts`         `github.service.ts`

  EP-21             `github.routes.ts`         `github.controller.ts`         `github.service.ts`

  EP-22             `github.routes.ts`         `github.controller.ts`         `github.service.ts`

  EP-23             `ticket.routes.ts`         `ticket.controller.ts`         `ticket.service.ts` +
                                                                              `ticket-generation.service.ts` +
                                                                              `github.service.ts`

  EP-24             `ticket.routes.ts`         `ticket.controller.ts`         `ticket.service.ts`

  EP-25             `ticket.routes.ts`         `ticket.controller.ts`         `ticket.service.ts`

  EP-26             `ticket.routes.ts`         `ticket.controller.ts`         `ticket.service.ts`

  EP-27             `ticket.routes.ts`         `ticket.controller.ts`         `ticket.service.ts`

  EP-28             `mentor.routes.ts`         `mentor.controller.ts`         `mentor.service.ts`

  EP-29             `mentor.routes.ts`         `mentor.controller.ts`         `mentor.service.ts`

  EP-30             `submission.routes.ts`     `submission.controller.ts`     `submission.service.ts` +
                                                                              `github.service.ts`

  EP-31             `submission.routes.ts`     `submission.controller.ts`     `submission.service.ts`

  EP-32             `submission.routes.ts`     `submission.controller.ts`     `submission.service.ts`

  EP-33             `webhook.routes.ts`        `webhooks/github.controller.ts` `github-webhook.service.ts` +
                                                                              `evaluation.service.ts`

  EP-34             `profile.routes.ts`        `profile.controller.ts`        `profile.service.ts`
  -------------------------------------------------------------------------------------------------------------

**Important:** EP-01--EP-05 are already-built authentication
infrastructure. They must not be rewritten merely to make the structure
symmetrical.

------------------------------------------------------------------------

## 7.6 File-to-Requirement Coverage

### Authentication

  Files                                                          Requirements
  -------------------------------------------------------------- ----------------------------
  existing auth files + `email-verification.service.ts`          FR-05, FR-06
  existing auth files + `password-reset.service.ts`              FR-07, FR-08
  existing auth files                                            FR-04, FR-10, FR-11, FR-12
  `user.service.ts`, `SettingsPage.tsx`, `useUpdateProfile.ts`   FR-13

### Subscription and payments

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `subscription.controller.ts`,       FR-15, FR-16, FR-18, FR-20, FR-21,
  `subscription.service.ts`,          FR-22
  `subscription-renewal.service.ts`,  
  `chapa.service.ts`                  

  `payment.controller.ts`,            FR-23
  `PaymentHistory.tsx`,               
  `usePayments.ts`                    

  `webhooks/chapa.controller.ts`,     FR-18, FR-19
  `webhook.routes.ts`,                
  `subscription.service.ts`           
  (`processChapaWebhook`)             

  `SubscriptionCard.tsx`,             FR-15--FR-23
  `BillingPage.tsx`,                  
  `CheckoutReturnPage.tsx`            
  -----------------------------------------------------------------------

### GitHub

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `github.service.ts`,                FR-25--FR-29
  `github.ts`, GitHub                 
  pages/components/hooks              

  `github-token.ts`                   encrypted-at-rest GitHub credential
                                      requirement

  `oauth-state.ts`                    signed, short-lived OAuth state
  -----------------------------------------------------------------------

### Tickets

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `ticket.service.ts`,                FR-30--FR-36
  `ticket-generation.service.ts`,     
  ticket routes/controllers           

  ticket templates (incl. django/)    FR-31

  `TicketPage.tsx` and ticket         FR-32--FR-36
  components                          
  -----------------------------------------------------------------------

### Mentor

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `mentor.service.ts`, `gemini.ts`,   FR-37--FR-41
  mentor routes/controller            

  `MentorPanel.tsx`, mentor hooks     FR-37--FR-41
  -----------------------------------------------------------------------

### Submission/evaluation

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `submission.service.ts`, GitHub     FR-42
  client/service                      

  `github-webhook.service.ts`,        FR-43, FR-49
  `webhooks/github.controller.ts`     

  `evaluation.service.ts`, `groq.ts`  FR-44, FR-46, FR-47

  `SubmissionCard.tsx`,               FR-36, FR-44--FR-49
  `EvaluationView.tsx`,               
  `ScoreBreakdown.tsx`,               
  `DiffViewer.tsx`                    
  -----------------------------------------------------------------------

### Profile

  -----------------------------------------------------------------------
  Files                               Requirements
  ----------------------------------- -----------------------------------
  `profile.service.ts`, profile       FR-50
  route/controller                    

  `ExperienceProfilePage.tsx`,        FR-50, FR-51
  `PracticeRecordNotice.tsx`,         
  `ExperienceItem.tsx`                
  -----------------------------------------------------------------------

### Unresolved/deferred

  Requirement   File decision
  ------------- ---------------
  FR-14         No V1 file
  FR-24         No V1 file
  FR-52         No V1 file
  ~~FR-53~~     No V1 file (Voxide → V2; doc 1 §1.5)

------------------------------------------------------------------------

## 7.7 Cross-Cutting Frontend Files

The following files are not tied to one page but are required by Doc 6's
cross-cutting behavior:

``` text
frontend/src/
├── components/layout/
│   ├── AppLayout.tsx
│   ├── AuthLayout.tsx
│   ├── FullPageLoader.tsx
│   ├── EmailVerificationBanner.tsx
│   └── SubscriptionBanner.tsx
├── components/common/
│   ├── ErrorState.tsx
│   ├── EmptyState.tsx
│   ├── StatusBadge.tsx
│   ├── ConfirmDialog.tsx
│   ├── ExternalLink.tsx
│   ├── CopyButton.tsx
│   ├── PasswordInput.tsx
│   ├── FormRootError.tsx
│   └── SubmitButton.tsx
├── routes/
│   ├── RequireAuth.tsx
│   ├── PublicOnly.tsx
│   └── RootRedirect.tsx
├── hooks/
│   ├── useSetupProgress.ts
│   ├── useUnsavedChangesWarning.ts
│   └── useDocumentTitle.ts
├── types/
│   └── api.ts
├── config/
│   ├── rubric.ts
│   └── app.config.ts
├── schemas/
│   ├── auth.schemas.ts
│   └── github.schemas.ts
└── lib/
    ├── api/
    │   ├── client.ts
    │   └── errors.ts
    ├── query-keys.ts
    ├── ticket-phase.ts
    ├── subscription-view.ts
    ├── navigation.ts
    ├── format.ts
    └── github.ts
```

These files collectively implement:

-   session restoration and 401 refresh;
-   protected/public routing;
-   safe `from` redirect handling;
-   query/mutation error behavior;
-   loading/empty/error patterns;
-   accessibility and focus behavior;
-   destructive-action confirmation;
-   no-token-in-browser-storage rule;
-   polling rather than WebSockets;
-   no automatic mutation retries.

------------------------------------------------------------------------

## 7.8 Backend Cross-Cutting Files

The exact existing filenames for the already-built middleware stack are
not supplied in the source docs. The following are therefore **required
responsibilities**, not invented replacement filenames:

``` text
Existing backend middleware/config to preserve:
- authentication middleware
- authLimiter
- validate.middleware
- error.middleware.ts
- Pino/request-ID logging
- cookie configuration
- JSON/raw-body parser ordering
```

New cross-cutting code must integrate with those existing conventions
rather than introduce a second error envelope, authentication mechanism,
or logging system.

------------------------------------------------------------------------

## 7.9 File Creation Order

The order below is intentionally dependency-first for AI-assisted,
per-file implementation. A file should not be generated before the
contract it depends on exists.

### Phase 1 --- Schema and constants

1.  `backend/prisma/schema.prisma`
2.  generated Prisma migration
3.  `backend/src/lib/scoring/rubric.ts`
4.  `backend/src/lib/crypto/token-hash.ts`
5.  `backend/src/lib/encryption/github-token.ts`
6.  `backend/src/lib/github/oauth-state.ts`

### Phase 2 --- External clients

7.  `backend/src/integrations/chapa.ts`
8.  `backend/src/integrations/github.ts`
9.  `backend/src/integrations/gemini.ts`
10. `backend/src/integrations/groq.ts`

### Phase 3 --- Pure/domain services

11. `email-verification.service.ts`
12. `password-reset.service.ts`
13. `email.service.ts`
14. `user.service.ts`
15. `subscription.service.ts`
16. `subscription-renewal.service.ts`
17. `chapa.service.ts`
18. `github.service.ts`
19. ticket template loader/index (react, node-express, django)
20. `ticket-generation.service.ts`
21. `ticket.service.ts`
22. `mentor.service.ts`
23. `github-webhook.service.ts`
24. `evaluation.service.ts`
25. `submission.service.ts`
26. `profile.service.ts`

### Phase 4 --- Validation and serializers

27. `user.validators.ts`
28. `github.validators.ts`
29. `ticket.validators.ts`
30. `mentor.validators.ts`
31. `submission.validators.ts`
32. serializers (`user`, `subscription`, `payment`, `repo`, `ticket`, `submission`, `evaluation`, `mentor-message`)

### Phase 5 --- Controllers and routes

33. `user.controller.ts`
34. `subscription.controller.ts`
35. `payment.controller.ts`
36. `github.controller.ts`
37. `ticket.controller.ts`
38. `mentor.controller.ts`
39. `submission.controller.ts`
40. `profile.controller.ts`
41. `webhooks/chapa.controller.ts`
42. `webhooks/github.controller.ts`
43. route registrations

### Phase 6 --- Frontend API foundation

44. `frontend/src/types/api.ts`
45. `frontend/src/lib/api/client.ts`
46. `frontend/src/lib/api/errors.ts`
47. `frontend/src/lib/query-keys.ts`
48. `frontend/src/config/app.config.ts` (+ `rubric.ts`)
49. `frontend/src/schemas/auth.schemas.ts`
50. `frontend/src/schemas/github.schemas.ts`
51. `frontend/src/lib/ticket-phase.ts`, `subscription-view.ts`, `navigation.ts`, `format.ts`, `github.ts`
52. auth hooks
53. billing hooks
54. GitHub hooks
55. ticket hooks
56. mentor hooks
57. submission hooks
58. profile hooks
59. cross-cutting hooks

### Phase 7 --- Shared frontend structure

60. `AuthLayout.tsx`
61. `AppLayout.tsx`
62. `FullPageLoader.tsx`
63. `EmailVerificationBanner.tsx`
64. `SubscriptionBanner.tsx`
65. route wrappers
66. common components
67. billing components
68. GitHub components
69. dashboard components
70. ticket components
71. profile components

### Phase 8 --- Pages

72. authentication pages
73. billing pages
74. GitHub setup page
75. dashboard
76. ticket page
77. profile
78. settings
79. not-found page

### Phase 9 --- Integration wiring

80. route registration and App entry wiring
81. Chapa return URL wiring
82. GitHub OAuth callback wiring
83. Chapa webhook raw-body wiring
84. GitHub `workflow_run` webhook wiring
85. subscription-renewal job wiring
86. frontend polling and cache invalidation
87. error/status mapping verification

### Phase 10 --- Final structural verification

Before implementation PRs are merged:

-   every EP-01--EP-34 is mapped to a route/controller/service or
    explicitly marked existing;
-   every PG-01--PG-13 has a file;
-   every frontend hook listed in Doc 6 exists;
-   Doc 10's shared frontend modules (types, config, lib helpers, schemas)
    exist;
-   every new DB entity in Doc 4 exists in Prisma;
-   no Voxide or deferred V1 files appear (Django starter/templates **are**
    in V1);
-   no endpoint introduces a second auth/token mechanism;
-   no client-side payment confirmation bypasses the Chapa webhook;
-   no submission path creates a third attempt;
-   no ticket path introduces a `scored` state;
-   no frontend path offers diff-paste instead of the required GitHub
    PR/diff;
-   no new file silently introduces a requirement not present in docs 2,
    4, 5, 6 or 8/10.

------------------------------------------------------------------------

## 7.10 Generated / Existing / New Classification

  -----------------------------------------------------------------------
  Area                                Classification
  ----------------------------------- -----------------------------------
  `User`, `RefreshToken`, existing    Existing; preserve
  auth/session infrastructure         

  `prisma/schema.prisma`              Existing file; modified

  Prisma migration                    Generated new artifact

  EP-01--EP-05                        Existing auth foundation; verify
                                      against Doc 5

  EP-06--EP-10                        Auth/account additions or changes

  EP-11--EP-34                        New V1 endpoint implementation

  `frontend/src/components/ui/*`      Existing template; preserve
  confirmed primitives                

  Additional shadcn primitives        Added from shadcn CLI when first
                                      needed; not custom-edited

  PG-01--PG-13                        New project pages

  Hooks listed in 6.4                 New project hooks

  Domain components listed in 6.3     New project components

  Ticket templates                    New team-authored code artifacts
                                      (react/, node-express/, django/);
                                      exact filenames TBD by actual
                                      template set

  Serializers (7.2.6)                 New; one per doc 5 §5.3.0 shape

  Doc 10 frontend shared modules      New (`types/api.ts`, `app.config.ts`,
                                      lib helpers, auth/github schemas)

  Voxide                              No V1 file (V2; doc 1 §1.5)

  Django starter/templates            In V1

  V2/V3 features                      No V1 files
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 7.11 Structural Rules for AI-Assisted Implementation

1.  **One file, one contract.** Each generated file must be checked
    against the relevant FR, DR, EP, PG or component entry before
    implementation.
2.  **Do not create undocumented product behavior.** If an
    implementation needs a behavior not defined in docs 2, 4, 5 or 6,
    stop and record it as an assumption/open question instead of
    silently adding it.
3.  **Do not duplicate infrastructure.** Authentication, error
    envelopes, logging, validation middleware, Prisma setup and
    cookie/session handling that already exist must be reused.
4.  **External services stay behind integration boundaries.** Chapa,
    GitHub, Gemini and Groq calls do not spread directly through
    controllers/components.
5.  **Database rules remain source-of-truth.** DR-01--DR-10 must not be
    weakened by application convenience.
6.  **State machines remain exact.** No `scored` ticket status is
    introduced. The final score belongs to `Evaluation`.
7.  **V1 scope remains closed.** Deferred requirements do not receive
    placeholder UI, routes, schema entities or "future-ready" behavior
    unless Doc 4 explicitly identifies an extension point.
8.  **Generated names are not invented.** Prisma migration timestamps
    and exact team-authored ticket-template filenames are
    generated/created artifacts, not architecture decisions.
9.  **Use case IDs are intentionally absent here.** Docs 2, 4, 5 and 6
    are sufficient for the current structure. When Doc 3 is finalized,
    add its `UC-##` references without renumbering existing IDs.
10. **Review against the source docs, not against the AI output.** This
    file is a map for implementation; the FR/API/DB/UI documents remain
    the detailed contracts.

------------------------------------------------------------------------

*Numbering convention: FR-##, UC-##, DR-##, A-##, Q-##, EP-## and PG-##
each form a continuous sequence across the whole series. Never renumber
once used. If an item is dropped, mark it `~~ID~~ (deprecated, see ID)`
instead.*

Next: proceed to → [8. Function-Level Spec — Backend](./work-simulator-function-level-spec-backend.md)

*(Frontend function-level spec is doc 10; frontend test plan is doc 11.)*
