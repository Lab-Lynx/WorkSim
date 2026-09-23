# 10. Function-Level Specification — Frontend

Project: Work Simulator · Links back to: [8. Function-Level Specification — Backend](./work-simulator-function-level-spec-backend.md) · Links forward to: [11. Test Plan & Test Files — Frontend](./work-simulator-test-plan-frontend.md)

This is the frontend implementation-level specification for Work Simulator V1. It is written against Docs 2, 5, 6 and the frontend portions of Doc 7, and it mirrors the structure of the backend function-level spec. Doc 6 defines what each page looks like and says; this document defines the functions, hooks, components and helpers that make it behave that way.

The implementation AI must use this document together with [5. API Specification], [6. Frontend — UI, Pages & Components], [7. Folder & File Structure], and the real existing frontend template/code. Where the template's real code contradicts a statement here, stop and record it as an assumption or open question instead of silently choosing (Doc 7, rule 2).

**How to read this document**
- Section numbers in this file are numbered 10.x (Doc 10, renumbered per D-20). Sections of the backend spec are cited as "backend 8.x" (Doc 8).
- Types are named, not written inline as unions inside tables. The named types are defined once in 10.3 (`SubmissionAttempt` is `1` or `2`, and so on).
- Every function has a `Test file`. Paths mirror the source path under `frontend/tests/` (A-58).
- "Doc 7" means the file is listed in Doc 7 section 7.3 (including the 10 frontend helper files added per D-27; see 10.2).

**Important source-of-truth rules**

- Do not redesign the already-built cookie authentication. Frontend code never reads, stores, or sends a token by hand. Every request uses `credentials: 'include'`. Nothing goes in `localStorage`, `sessionStorage` or IndexedDB (Doc 6, A-53).
- Do not introduce GitHub-only login. GitHub is connected after login, on `/github`, for repository access only.
- Do not confirm or activate a subscription from the Chapa return page. `CheckoutReturnPage` only polls EP-15 and shows "subscribed" when EP-15 says `status` is `active` and `hasAccess` is `true`.
- Do not render card or payment fields anywhere (FR-17).
- Do not let the client choose the submission attempt or the mentor hint level. EP-30 sends no body. The attempt used for EP-31 and EP-32 comes from the submission data on screen, never from user input.
- Do not show a score for attempt 1. Do not offer a third submission. Do not introduce a `scored` ticket status. Do not offer a paste-a-diff fallback.
- Rubric weights come only from `frontend/src/config/rubric.ts`. The UI never calculates a total. It shows `scores.total` as the API returned it.
- Do not add Voxide UI (deferred to V2 per D-05/D-07), and do not add any V2/V3 UI (no public profile links, search, uploads, admin, MFA, localization). Django starter template is supported in V1 alongside React and Node/Express per D-05.
- Do not invent behavior for open questions. Each stays isolated in one constant or one branch:
  - `Q-14` (price display), `Q-15` (what a `past_due` user can do), `Q-16` (OAuth `access_denied`), `Q-17` (Markdown), `Q-18` (support contact) — from Doc 6.
  - `Q-04` (resolved by D-01: unverified users get 403 on checkout EP-13; dashboard/tickets accessible), `Q-08` (permission wording), `Q-10a/b` (mentor limit and length; Q-10c resolved by D-04: mentor allowed in `in_progress` and `submitted_v1` revision phase), `Q-11` (resolved by D-12: resetPassword revokes sessions), `Q-12` (cookie `SameSite`/CSRF), `Q-13` (submission timeouts) — from Docs 4 and 5.
- Every ownership failure shows the same "not found" state. The UI never hints that another user's resource exists.
- Frontend validation is a convenience. The server stays authoritative, and every server error must still be shown.
- Mutations never retry automatically. The single exception is the replay of one request that the server rejected with 401 before processing it, after a successful session refresh (10.4).
- API text (mentor replies, feedback, `failureReason`, diffs) is data. It is rendered as text, never as HTML.

---

## 10.1 Frontend Function Map

The specification is grouped by implementation responsibility, in the order files should be built (10.29).

| Area | Main files | High-scrutiny functions |
|---|---|---|
| API foundation | `lib/api/client.ts`, `lib/api/errors.ts`, `config/app.config.ts` | `apiRequest`, `refreshSessionOnce`, `mapApiError`, `applyServerErrorToForm`, `handleGlobalApiError`, `shouldRetryQuery` |
| Pure helpers | `lib/ticket-phase.ts`, `lib/subscription-view.ts`, `lib/navigation.ts`, `lib/format.ts`, `lib/github.ts`, `lib/query-keys.ts`, `schemas/*` | `getTicketPhase`, `getSubscriptionView`, `getSafeRedirectPath`, `parseGitHubOAuthResult`, form schemas |
| Session and routing | `hooks/auth/useMe.ts`, `routes/*`, layout components | `useMe`, `RequireAuth`, `PublicOnly`, `RootRedirect`, session-expiry wiring |
| Auth hooks | `hooks/auth/*` | `useLogin`, `useLogout`, `useVerifyEmail`, `useResendVerification` |
| Billing | `hooks/billing/*`, `components/billing/*`, billing pages | `useSubscription` polling, `useStartCheckout`, `useCancelSubscription`, `CheckoutReturnPage` |
| GitHub | `hooks/github/*`, `components/github/*`, `GitHubSetupPage` | `useGitHubConnect`, `useCreateRepo`, `parseGitHubOAuthResult` |
| Tickets | `hooks/tickets/*`, `components/ticket/*`, `TicketPage` | `useAssignTicket`, `useAbandonTicket`, `getTicketPhase`, `TicketActionBar` |
| Mentor | `hooks/mentor/*`, `MentorPanel`, `MentorComposer` | `useSendMentorMessage`, pending-message reconciliation |
| Submissions | `hooks/submissions/*`, `SubmissionsPanel`, `SubmissionCard` | `useSubmission` polling, `useSubmitWork`, `useRetrySubmission` |
| Profile | `hooks/profile/*`, `components/profile/*`, `ExperienceProfilePage` | `PracticeRecordNotice`, `ExperienceItem` |
| Common UI | `components/common/*` | `ConfirmDialog`, `ExternalLink`, `SubmitButton`, `StatusBadge` |
| Cross-cutting hooks | `hooks/useSetupProgress.ts`, `useUnsavedChangesWarning.ts`, `useDocumentTitle.ts` | `getSetupProgress`, `useUnsavedChangesWarning` |
| App wiring | template App/router entry, existing `QueryClient` setup | route table, `onSessionExpired`, query/mutation defaults |

---

# 10.2 Files This Spec Needs That Doc 7 Does Not List

Doc 7 originally listed pages, components and hooks, but omitted shared types, Zod schemas, timing constants, and pure helpers. Per D-27, these ten files are formalized in Doc 7 section 7.3. No product behavior is added by them.

| File | Holds | Needed by |
|---|---|---|
| `frontend/src/types/api.ts` | TypeScript types for the Doc 5 shared objects and envelope | every hook and component |
| `frontend/src/config/app.config.ts` | polling, timeout, cooldown and cache constants; the mentor length constant | client, hooks, pages |
| `frontend/src/lib/query-keys.ts` | the one query-key factory | every hook |
| `frontend/src/lib/ticket-phase.ts` | `getTicketPhase`, `getTicketStatusLabel` | TicketPage, ticket components, dashboard card |
| `frontend/src/lib/subscription-view.ts` | `getSubscriptionView` | SubscriptionCard, SubscriptionBanner |
| `frontend/src/lib/navigation.ts` | `getSafeRedirectPath`, `buildLoginRedirect` | LoginPage, RequireAuth, session-expiry wiring |
| `frontend/src/lib/format.ts` | `formatDate`, `formatDateTime`, `formatAmount`, `formatScore` | billing, ticket and profile components |
| `frontend/src/lib/github.ts` | `buildRepoUrl`, `buildBranchUrl`, `parseGitHubOAuthResult`, OAuth error text | GitHub and ticket components |
| `frontend/src/schemas/auth.schemas.ts` | Zod schemas for register, login, forgot, reset, change-password, profile, resend | auth pages, SettingsPage |
| `frontend/src/schemas/github.schemas.ts` | Zod schema for the repo form | RepoCreateForm |

The route table, the `QueryClient` defaults and the session-expiry wiring live in the template's existing App/router entry files. Doc 7 does not name them (Doc 7 phase 9, items 72 and 77), so they are specified as behavior in 10.23, not as new files.

---

# 10.3 Shared Types and Constants

## 10.3.1 `frontend/src/types/api.ts` (Doc 7, D-27)

These mirror Doc 5 section 5.3.0 exactly. Types are compile-time only; the client checks the envelope at run time and nothing more (A-59).

```ts
export type ISODateString = string;
export type UUID = string;

export interface ApiEnvelope<T> { statusCode: number; success: boolean; message: string; data: T }
export interface ApiResult<T> { data: T; message: string; statusCode: number }

export interface User {
  id: UUID; name: string; email: string; role: string;
  emailVerifiedAt: ISODateString | null; createdAt: ISODateString;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';
export interface Subscription {
  id: UUID; status: SubscriptionStatus; currentPeriodEnd: ISODateString; canceledAt: ISODateString | null;
}
export interface SubscriptionStatusResponse { subscription: Subscription | null; hasAccess: boolean }

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';
export interface Payment {
  id: UUID; amount: string; currency: string; status: PaymentStatus;
  paidAt: ISODateString | null; createdAt: ISODateString;
}

export type StarterTemplate = 'react' | 'node_express' | 'django';
export interface Repo { fullName: string; starterTemplate: StarterTemplate; defaultBranch: string }
export interface GitHubConnectionSummary { connected: boolean; githubLogin: string | null; repo: Repo | null }

export type TicketStatus = 'assigned' | 'in_progress' | 'submitted_v1' | 'resubmitted' | 'done' | 'abandoned';
export interface Ticket {
  id: UUID; status: TicketStatus; templateKey: string; title: string; scenario: string;
  category: string; difficulty: string; touchedFiles: string[]; acceptanceCriteria: string[];
  testChecklist: string[]; branchName: string; repo: { fullName: string; defaultBranch: string };
  createdAt: ISODateString; completedAt: ISODateString | null; abandonedAt: ISODateString | null;
}

export type SubmissionAttempt = 1 | 2;
export type SubmissionStatus = 'awaiting_ci' | 'evaluating' | 'completed' | 'failed';
export interface EvaluationScores {
  requirementsMet: number; correctnessTests: number; codeQuality: number; problemSolving: number; total: number;
}
export interface Evaluation { feedback: string; scores: EvaluationScores | null; createdAt: ISODateString }
export interface Submission {
  id: UUID; attempt: SubmissionAttempt; status: SubmissionStatus; prNumber: number; prUrl: string;
  headSha: string; ciPassed: boolean | null; ciRunUrl: string | null; failureReason: string | null;
  submittedAt: ISODateString; evaluation: Evaluation | null; diff?: string;
}
export interface TicketWithSubmissions { ticket: Ticket; submissions: Submission[] }
export interface AbandonResult { abandonedTicketId: UUID; newTicket: Ticket | null }

export type MentorMessageRole = 'user' | 'mentor';
export interface MentorMessage { id: UUID; role: MentorMessageRole; content: string; createdAt: ISODateString }

export interface ProfileItem {
  ticketId: UUID; title: string; category: string; difficulty: string;
  completedAt: ISODateString; evaluation: Evaluation;
}

export type LoginNotice = 'session_expired' | 'password_reset' | 'logged_out_all';
```

## 10.3.2 `frontend/src/config/app.config.ts` (Doc 7, D-27)

Every value here is a constant, not a product decision. Values marked "Doc 6" come from Doc 6 A-42 and are tunable after testing. Values marked "pending" have no answer yet and must not be replaced with a made-up number.

| Constant | Value | Source |
|---|---|---|
| `API_BASE_PATH` | `'/api/v1'` | D-34 template audit: verified against `frontend/.env`, `frontend/.env.example`, and the existing Axios `baseURL` |
| `REQUEST_TIMEOUT_DEFAULT_MS` | `30000` | Doc 6, A-42 |
| `REQUEST_TIMEOUT_LONG_MS` | `60000` (applied by `apiRequest` to EP-22, EP-23, EP-27, EP-28, EP-30) | Doc 6, A-42 |
| `CHECKOUT_POLL_INTERVAL_MS` | `2000` | Doc 6, A-42 |
| `CHECKOUT_POLL_MAX_MS` | `60000` | Doc 6, A-42 |
| `SUBMISSION_POLL_FAST_MS` | `3000` | Doc 6, A-42 |
| `SUBMISSION_POLL_SLOW_MS` | `10000` | Doc 6, A-42 |
| `SUBMISSION_POLL_SLOW_AFTER_MS` | `120000` (also when the "taking longer" hint appears) | Doc 6, A-42 |
| `SUBMISSION_POLL_STOP_AFTER_MS` | `600000` | Doc 6, A-42 |
| `RESEND_COOLDOWN_MS` | `60000` | Doc 6, A-42 |
| `TICKET_DONE_SYNC_INTERVAL_MS` | `2000` | Doc 6, PG-10 |
| `TICKET_DONE_SYNC_MAX_ATTEMPTS` | `3` | Doc 6, PG-10 |
| `ME_STALE_TIME_MS` | `300000` | A-65 |
| `COPY_FEEDBACK_MS` | `2000` (how long "Copied" is announced) | A-74 |
| `MENTOR_MESSAGE_MAX_CHARS` | `null` (typed as a number or `null`) | pending, Q-10b. `null` hides the counter |

## 10.3.3 `frontend/src/config/rubric.ts` (Doc 7)

| Field | Detail |
|---|---|
| Signature | `RUBRIC_CATEGORIES: readonly RubricCategory[]` where `RubricCategory = { key: ScoreKey; label: string; weightPercent: number }`, and `type ScoreKey` is one of the four keys of `EvaluationScores` other than `total`. |
| Purpose | The one source of the four fixed category labels and weights the UI displays. |
| Output | Exactly four entries in this order: `requirementsMet` "Requirements met" 40; `correctnessTests` "Correctness & tests" 25; `codeQuality` "Code quality" 20; `problemSolving` "Problem-solving & communication" 15. |
| Rules | Weights are display text only. The UI never multiplies, sums or rounds scores into a total. The four weights must add up to 100, and a unit test asserts it. Do not read weights from the API or the client's state. |
| Edge cases | Adding or reweighting a category is a change to Doc 2 first, never a code change here. |
| Test file | `frontend/tests/config/rubric.test.ts` |

## 10.3.4 `frontend/src/lib/query-keys.ts` (Doc 7, D-27)

| Field | Detail |
|---|---|
| Signature | `queryKeys` object with: `me`, `subscription`, `payments`, `githubConnection`, `currentTicket`, `profile` (constant tuples), and `ticket(id: string)`, `mentor(id: string)`, `submission(id: string, attempt: SubmissionAttempt, includeDiff: boolean)` (functions returning tuples). |
| Purpose | One place that defines every cache key, so no hook types a key by hand. |
| Output | Tuples exactly as Doc 6, 6.5.11 lists them: `['me']`, `['subscription']`, `['payments']`, `['github-connection']`, `['ticket','current']`, `['ticket', id]`, `['mentor', id]`, `['submission', id, attempt, includeDiff]`, `['profile']`. |
| Rules | Every `useQuery`, `setQueryData`, and `invalidateQueries` call takes its key from this object. |
| Edge cases | `['ticket','current']` and `['ticket', id]` share the first element. Never invalidate the bare `['ticket']` prefix, because that refetches every open ticket. |
| Test file | `frontend/tests/lib/query-keys.test.ts` |

---

# 10.4 API Foundation

Files: `frontend/src/lib/api/client.ts` and `frontend/src/lib/api/errors.ts` (Doc 7). These are the only files that talk HTTP. Hooks and pages never call `fetch` directly.

Shared shapes used below (defined in `errors.ts` and `client.ts`):

```ts
export type ApiErrorKind = 'api' | 'network' | 'timeout' | 'unexpected_response';

export class ApiError extends Error {
  status: number;        // HTTP or envelope status; 0 when no response arrived
  kind: ApiErrorKind;
  constructor(status: number, message: string, kind: ApiErrorKind);
}

export type UiErrorAction =
  | 'none' | 'retry' | 'go_billing' | 'reconnect_github' | 'refetch' | 'request_new_link';

export interface UiError {
  status: number; kind: ApiErrorKind; message: string;
  action: UiErrorAction; isNotFound: boolean; isTimeout: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;          // overrides the default or long timeout chosen by path
  signal?: AbortSignal;        // from TanStack Query, for cancellation
  skipAuthRefresh?: boolean;   // internal: used for the replay and for EP-03 itself
}
export interface ApiClientConfig { baseUrl: string; onSessionExpired: () => void }
```

## apiRequest — `frontend/src/lib/api/client.ts`

| Field | Detail |
|---|---|
| Signature | `apiRequest<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<ApiResult<T>>` |
| Purpose | Send one request to `{baseUrl}{API_BASE_PATH}{path}`, unwrap the Doc 5 envelope, and raise `ApiError` for failures. |
| Inputs | HTTP method, path relative to the API base (for example `/auth/login`), optional body, query, timeout, abort signal. |
| Output | `{ data, message, statusCode }` from the envelope. Callers that show the server's message (EP-07, EP-08) read `message`. Others read `data`. |
| Throws | `ApiError` with `kind: 'api'` for `success: false` or a non-2xx envelope. `kind: 'timeout'` when the timer fires. `kind: 'network'` when `fetch` itself fails (offline, DNS, CORS). `kind: 'unexpected_response'` when the body is not JSON or not envelope-shaped (for example an HTML 502 from a proxy). An abort caused by the caller's `signal` is re-thrown unchanged and is not an `ApiError`. |
| Side effects | One HTTP request. On a 401, possibly one call to `refreshSessionOnce` and one replay of the original request. May call `onSessionExpired` once. |
| Rules | 1) Always `credentials: 'include'`. 2) Send `Content-Type: application/json` only when a body exists. 3) Envelope check is exactly: `statusCode` is a number, `success` is a boolean, `message` is a string. Nothing deeper is validated (A-59). 4) A 401 on any path **not** in `NO_REFRESH_PATHS` and without `skipAuthRefresh` triggers `refreshSessionOnce()`, then one replay with `skipAuthRefresh: true`. `NO_REFRESH_PATHS` is exactly `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`. 5) If the refresh itself fails with a 401, or the replay returns 401 again, call `onSessionExpired()` (once, guarded) and throw the original 401 `ApiError`. 6) If the refresh fails for any other reason (network, timeout, 5xx), throw that error and do **not** log the user out (A-60). 7) Never retry any other failure. 8) Never read or write cookies, `localStorage`, `sessionStorage` or IndexedDB. 9) Never log request bodies, response bodies, headers or error payloads. 10) Timeouts follow Doc 6 (Doc 7, 7.3.10 puts them in this file): `timeoutMs` defaults to `REQUEST_TIMEOUT_LONG_MS` for exactly these calls: `POST /github/repo`, `POST /tickets`, `POST /tickets/:ticketId/abandon`, `POST /tickets/:ticketId/mentor/messages` and `POST /tickets/:ticketId/submissions`. Every other call uses `REQUEST_TIMEOUT_DEFAULT_MS`. An explicit `options.timeoutMs` overrides both. Hooks never set timeouts themselves. |
| Edge cases | Several requests fail with 401 at once (they all wait on the same refresh, then each replays once). A 401 on EP-02 (wrong credentials) must reach the login form as an error and must never trigger a refresh. A response that arrives after the timeout fired is ignored. A proxy HTML page with status 502 becomes `unexpected_response`. Empty body on a 2xx is `unexpected_response`. A replay whose body was already consumed must be rebuilt from `options.body`, not reused. |
| Test file | `frontend/tests/lib/api/client.test.ts` |

## configureApiClient — `frontend/src/lib/api/client.ts`

| Field | Detail |
|---|---|
| Signature | `configureApiClient(config: ApiClientConfig): void` |
| Purpose | Give the client its base URL and the session-expiry callback without importing router or query-cache code into `client.ts`. |
| Inputs | Base URL (from the single frontend environment variable, A-57) and `onSessionExpired`. |
| Output | None. |
| Throws | `apiRequest` throws a plain `Error('API client is not configured')` if called before this. That is a programming error and is never shown to users. |
| Side effects | Stores the config in module scope. |
| Rules | Called exactly once, at app start, from the App entry (8.23). |
| Test file | `frontend/tests/lib/api/client.test.ts` |

## refreshSessionOnce — `frontend/src/lib/api/client.ts` (internal, exported for tests)

| Field | Detail |
|---|---|
| Signature | `refreshSessionOnce(): Promise<void>` |
| Purpose | Call EP-03 once for every request that failed with 401 at the same moment. |
| Inputs | None. The refresh cookie is sent automatically. |
| Output | Resolves when the cookies have been rotated. |
| Throws | The `ApiError` from EP-03 (401 for a dead session). |
| Side effects | `POST /auth/refresh` with `skipAuthRefresh: true` and no body. On success, resets the session-expired guard (below). |
| Rules | A module-level `inFlight` promise is returned to every caller until it settles, then cleared in `finally`. It must never call `apiRequest` without `skipAuthRefresh` (that would recurse). |
| Edge cases | Two callers arriving while `inFlight` is set. A caller arriving one tick after it settled (starts a new refresh, which is correct). |
| Test file | `frontend/tests/lib/api/client.test.ts` |

## resetSessionExpiredGuard — `frontend/src/lib/api/client.ts`

| Field | Detail |
|---|---|
| Signature | `resetSessionExpiredGuard(): void` |
| Purpose | Allow `onSessionExpired` to fire again after the user has a valid session. |
| Rules | `onSessionExpired` is guarded by a module flag so that many failing requests cause one redirect. The flag is cleared by `useLogin` on success and by `refreshSessionOnce` on success. |
| Test file | `frontend/tests/lib/api/client.test.ts` |

## mapApiError — `frontend/src/lib/api/errors.ts`

| Field | Detail |
|---|---|
| Signature | `mapApiError(error: unknown): UiError` |
| Purpose | Turn any thrown value into the message and recovery action Doc 6, 6.5.3, defines. This is the only status-to-behavior table in the app. |
| Inputs | Anything caught from a hook or mutation. |
| Output | `UiError`. A non-`ApiError` value becomes `status: 0`, `kind: 'network'`, the generic message, `action: 'retry'`. |
| Rules | Server `message` is used unchanged for `kind: 'api'`. The generic text is `GENERIC_NETWORK_MESSAGE` = "Can't reach the server. Check your connection and try again." and is used for `network`, `timeout` and `unexpected_response`. The mapping is the table below. |
| Edge cases | Envelope with a 5xx status other than 502 (Doc 5 lists none): handled like 502, with the server message (A-62). |
| Test file | `frontend/tests/lib/api/errors.test.ts` |

| Condition | `action` | `isNotFound` |
|---|---|---|
| `network`, `timeout`, `unexpected_response` | `retry` | false |
| 400 | `none` | false |
| 401 | `none` (session flow already ran, or EP-02 wrong credentials) | false |
| 402 | `go_billing` | false |
| 403 | `reconnect_github` | false |
| 404 | `none` | true |
| 409 | `refetch` | false |
| 410 | `request_new_link` | false |
| 429 | `none` | false |
| 502, or any other 5xx | `retry` | false |
| any other 4xx | `none` | false |

`isTimeout` is `true` only for `kind: 'timeout'`.

## applyServerErrorToForm — `frontend/src/lib/api/errors.ts`

| Field | Detail |
|---|---|
| Signature | `applyServerErrorToForm(error: unknown, form: { setError: UseFormSetError<FieldValues> }, context?: FormErrorContext): UiError` where `FormErrorContext` is `'register'`, `'changePassword'`, or `'resetPassword'`. |
| Purpose | Put a server error on the right place in a react-hook-form form. |
| Output | The `UiError` (so the caller can focus a field or show a link). |
| Side effects | Calls `form.setError`. |
| Rules | Server errors are one message string with no field (Doc 5, A-19), so the default is `setError('root', { type: 'server', message })`. Exactly three exceptions exist, all by status plus exact message (A-41, A-63): `register` with status 409 sets `email`; `changePassword` with status 400 and message equal to `SERVER_MESSAGES.currentPasswordIncorrect` sets `currentPassword`; `resetPassword` with status 400 and message equal to `SERVER_MESSAGES.invalidResetLink` is **not** set on the form and is returned so the page can show its invalid-link view. `SERVER_MESSAGES` is one exported constant: `{ currentPasswordIncorrect: 'Current password is incorrect', invalidResetLink: 'Invalid reset link' }`. |
| Edge cases | A changed server message silently falls back to `root`, which is safe. A `timeout` error on a mutation form still sets `root` with the generic text. |
| Test file | `frontend/tests/lib/api/errors.test.ts` |

## handleGlobalApiError — `frontend/src/lib/api/errors.ts`

| Field | Detail |
|---|---|
| Signature | `handleGlobalApiError(error: unknown, queryClient: QueryClient): void` |
| Purpose | Keep cached access state honest when any call is refused. |
| Side effects | For `ApiError` status 402: `invalidateQueries(queryKeys.subscription)`. For status 403: `invalidateQueries(queryKeys.githubConnection)`. Nothing else. |
| Rules | Never shows UI, never navigates. Pages show the message through `mapApiError`. Registered on the `QueryClient`'s query and mutation `onError` (10.23). |
| Edge cases | Invalidating must never trigger a request that itself returns 402 or 403 (EP-15 and EP-20 do not), so there is no loop. |
| Test file | `frontend/tests/lib/api/errors.test.ts` |

## shouldRetryQuery — `frontend/src/lib/api/errors.ts`

| Field | Detail |
|---|---|
| Signature | `shouldRetryQuery(failureCount: number, error: unknown): boolean` |
| Purpose | Query retry policy from Doc 6, 6.5.3. |
| Rules | Return `true` only when `failureCount < 1` and the error is an `ApiError` with `kind` `network` or `timeout`, or with status 500 or higher. Return `false` for every 4xx and for aborts. Mutations use `retry: false` and never call this. |
| Test file | `frontend/tests/lib/api/errors.test.ts` |

---

# 10.5 Pure Helpers and Schemas

These have no React, router or network code. They are the most testable part of the frontend and carry the rules that are easiest to get subtly wrong.

## getTicketPhase — `frontend/src/lib/ticket-phase.ts` (Doc 7, D-27)

```ts
export type TicketPhaseKey =
  | 'ready_to_start' | 'in_progress'
  | 'first_review_processing' | 'feedback_ready' | 'first_review_failed'
  | 'final_review_processing' | 'final_review_failed' | 'final_review_finalizing'
  | 'done' | 'abandoned';
export type TicketPrimaryAction = 'start' | 'submit' | 'resubmit' | 'retry' | 'get_next';
export type MentorAvailability = 'not_started' | 'enabled' | 'unavailable_after_submit' | 'read_only';
export type TicketTab = 'ticket' | 'mentor' | 'submissions';
export interface TicketPhaseInfo {
  key: TicketPhaseKey; label: string;
  primaryAction: TicketPrimaryAction | null; retryAttempt: SubmissionAttempt | null;
  mentor: MentorAvailability; canAbandon: boolean; isProcessing: boolean; defaultTab: TicketTab;
}
```

| Field | Detail |
|---|---|
| Signature | `getTicketPhase(ticket: Ticket, submissions: Submission[]): TicketPhaseInfo` |
| Purpose | Decide everything the ticket workspace shows and allows, from `ticket.status` plus the latest submission's `status`. This encodes the Doc 6 PG-10 phase table. |
| Inputs | The ticket and its 0–2 submission summaries from EP-25 (any order). |
| Output | `TicketPhaseInfo` as in the table below. The same file exports `TICKET_PHASE_LABELS`, a record from every `TicketPhaseKey` to its label in that table, which `StatusBadge` uses. |
| Rules | "Latest submission" is the one with the highest `attempt`. Only the ticket's own `status` selects the row family; the submission `status` only refines it. `isProcessing` is `true` when the latest submission is `awaiting_ci` or `evaluating`. Per D-04 (resolving Q-10c), the mentor is available during `in_progress` and `submitted_v1` (specifically `feedback_ready`, where the user revises code based on attempt 1 feedback before resubmitting). In `resubmitted`, `done`, `abandoned`, or `assigned`, the mentor is disabled. |
| Edge cases | `submitted_v1` or `resubmitted` with the expected submission missing from the list: return the matching `*_processing` phase (the ticket query is refetching) and never throw. An unknown `status` string at run time: return `in_progress`-safe defaults with `primaryAction: null`, `canAbandon: false`, `mentor: 'read_only'`. The `final_review_finalizing` phase exists because attempt 2 can be `completed` a moment before the ticket reads `done` (PG-10 state list, A-70). |
| Test file | `frontend/tests/lib/ticket-phase.test.ts` |

| Ticket `status` | Latest submission | `key` | `label` | `primaryAction` | `retryAttempt` | `mentor` | `canAbandon` | `defaultTab` |
|---|---|---|---|---|---|---|---|---|
| `assigned` | none | `ready_to_start` | Ready to start | `start` | none | `not_started` | true | `ticket` |
| `in_progress` | none | `in_progress` | In progress | `submit` | none | `enabled` | true | `ticket` |
| `submitted_v1` | #1 `awaiting_ci`, `evaluating`, or missing | `first_review_processing` | First review in progress | none | none | `unavailable_after_submit` | false | `submissions` |
| `submitted_v1` | #1 `completed` | `feedback_ready` | Feedback ready | `resubmit` | none | `enabled` | false | `submissions` |
| `submitted_v1` | #1 `failed` | `first_review_failed` | Review failed | `retry` | 1 | `unavailable_after_submit` | false | `submissions` |
| `resubmitted` | #2 `awaiting_ci`, `evaluating`, or missing | `final_review_processing` | Final review in progress | none | none | `unavailable_after_submit` | false | `submissions` |
| `resubmitted` | #2 `failed` | `final_review_failed` | Final review failed | `retry` | 2 | `unavailable_after_submit` | false | `submissions` |
| `resubmitted` | #2 `completed` | `final_review_finalizing` | Finalizing | none | none | `unavailable_after_submit` | false | `submissions` |
| `done` | any | `done` | Done | `get_next` | none | `read_only` | false | `submissions` |
| `abandoned` | any | `abandoned` | Abandoned | none | none | `read_only` | false | `ticket` |

## getTicketStatusLabel — `frontend/src/lib/ticket-phase.ts`

| Field | Detail |
|---|---|
| Signature | `getTicketStatusLabel(status: TicketStatus): string` |
| Purpose | A coarse label for places that only have the ticket, not its submissions (the dashboard's `CurrentTicketCard`, from EP-24). |
| Output | `assigned` → "Ready to start"; `in_progress` → "In progress"; `submitted_v1` → "First review"; `resubmitted` → "Final review"; `done` → "Done"; `abandoned` → "Abandoned". |
| Rules | Never used on `TicketPage`, which uses `getTicketPhase` (A-69). |
| Test file | `frontend/tests/lib/ticket-phase.test.ts` |

## getSubscriptionView — `frontend/src/lib/subscription-view.ts` (Doc 7, D-27)

```ts
export type SubscriptionViewKind =
  | 'never' | 'active' | 'renewal_pending'
  | 'past_due_access' | 'past_due_ended' | 'canceled_access' | 'ended' | 'unknown';
export type SubscriptionPrimaryAction = 'subscribe' | 'cancel';
export interface SubscriptionView {
  kind: SubscriptionViewKind; periodEnd: string | null;
  primaryAction: SubscriptionPrimaryAction | null; showsBanner: boolean;
}
```

| Field | Detail |
|---|---|
| Signature | `getSubscriptionView(data: SubscriptionStatusResponse): SubscriptionView` |
| Purpose | The one place that turns `subscription` plus `hasAccess` into a display case. It encodes the Doc 6 PG-07 case table. |
| Output | See the table below. `periodEnd` is `subscription.currentPeriodEnd`, or `null` when there is no subscription. It is "next billing date" for `active` and "access ends" for `canceled_access` (A-48). |
| Rules | `subscribe` is offered only when `hasAccess` is `false`, and never for `past_due` (Q-15). `showsBanner` is `true` for `past_due_access`, `past_due_ended`, `canceled_access`, `ended` only. It is `false` for `never`, `active`, `renewal_pending`. The function returns kinds and dates, never user-facing copy; copy lives in `SubscriptionCard` and `SubscriptionBanner`. |
| Edge cases | `status: 'active'` with `hasAccess: false` is `renewal_pending` (the period ended and the renewal webhook has not arrived). An unexpected `status` string returns `unknown` with no action and no banner. |
| Test file | `frontend/tests/lib/subscription-view.test.ts` |

| `subscription` | `hasAccess` | `kind` | `primaryAction` |
|---|---|---|---|
| `null` | false | `never` | `subscribe` |
| `active` | true | `active` | `cancel` |
| `active` | false | `renewal_pending` | none |
| `past_due` | true | `past_due_access` | none |
| `past_due` | false | `past_due_ended` | none |
| `canceled` | true | `canceled_access` | none |
| `canceled` | false | `ended` | `subscribe` |

## getSafeRedirectPath and buildLoginRedirect — `frontend/src/lib/navigation.ts` (Doc 7, D-27)

| Field | Detail |
|---|---|
| Signature | `getSafeRedirectPath(raw: string \| null \| undefined, fallback?: string): string` and `buildLoginRedirect(currentPathAndSearch: string): string` |
| Purpose | Stop open redirects through `?from=`, and build the login URL for a logged-out visitor. |
| Rules | `getSafeRedirectPath` parses `raw` against a dummy origin (`new URL(raw, 'http://localhost')`). It returns `pathname + search + hash` only when the parsed origin is unchanged (this rejects `//evil.com`, `/\evil.com`, and absolute URLs), the path does not contain a control character, and the pathname is not `/login` or `/register`. Otherwise it returns `fallback`, default `/dashboard`. `buildLoginRedirect` returns `/login?from=<encodeURIComponent(path)>`, or plain `/login` when the path is `/`, `/login` or `/register`. |
| Edge cases | `null`, empty string, `//host`, `/\host`, `https://host`, `javascript:…`, `/login`, an encoded newline, a very long string. |
| Test file | `frontend/tests/lib/navigation.test.ts` |

## Formatters — `frontend/src/lib/format.ts` (Doc 7, D-27)

| Field | Detail |
|---|---|
| Signature | `formatDate(iso: string \| null \| undefined): string`, `formatDateTime(iso: string \| null \| undefined): string`, `formatAmount(amount: string, currency: string): string`, `formatScore(value: number): string` |
| Purpose | The only display formatting in the app (A-49, A-72). |
| Output | `formatDate`: English day-month-year in the browser's timezone, for example "19 Sep 2026". `formatDateTime`: the same plus 24-hour time, for example "19 Sep 2026, 14:05". `formatAmount`: the API's decimal string, a space, then the currency code, with no rounding or conversion (for example "499.00 ETB"). `formatScore`: a whole number, or one decimal place when the value is not whole. |
| Rules | An invalid or missing date returns "—", never "Invalid Date". `formatAmount` never parses the string as a float. |
| Test file | `frontend/tests/lib/format.test.ts` |

## GitHub helpers — `frontend/src/lib/github.ts` (Doc 7, D-27)

```ts
export type GitHubOAuthResult = { status: 'connected' } | { status: 'error'; reason: string | null };
```

| Field | Detail |
|---|---|
| Signature | `buildRepoUrl(fullName: string): string \| null`, `buildBranchUrl(fullName: string, branch: string): string \| null`, `parseGitHubOAuthResult(searchParams: URLSearchParams): GitHubOAuthResult \| null`, `getGitHubOAuthErrorMessage(reason: string \| null): string` |
| Purpose | Safe GitHub URLs and OAuth callback parsing (Doc 6, PG-09). |
| Output | `buildRepoUrl`: `'https://github.com/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name)` only when `fullName` matches `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`; otherwise `null`. `buildBranchUrl`: adds `'/tree/' + encodeURIComponent(branch)`. `parseGitHubOAuthResult`: reads `searchParams.get('github')`; `'connected'` → `{ status: 'connected' }`; `'error'` → `{ status: 'error', reason: searchParams.get('reason') }`; any other value → `null`. `getGitHubOAuthErrorMessage`: `state_invalid` → "Authentication session expired. Try connecting again."; `scope_invalid` → "Work Simulator needs repository permission to work on tickets. Try connecting again."; `exchange_failed` → "Couldn't connect to GitHub. Try again."; any other value (including null) → "Couldn't connect to GitHub. Try again." |
| Rules | Link builders never return a non-GitHub URL, never return `javascript:`, and return `null` on untrusted input so callers render plain text instead of an anchor. `getGitHubOAuthErrorMessage` never echoes the raw reason string. |
| Edge cases | `fullName` containing `..`, spaces, encoded characters, or more than one slash. |
| Test file | `frontend/tests/lib/github.test.ts` |

## Schemas — `frontend/src/schemas/auth.schemas.ts` and `github.schemas.ts` (Doc 7, D-27)

One place for every validation rule. Every message is exported so tests assert the exact copy.

| Schema | Fields and rules | Messages |
|---|---|---|
| `registerSchema` | `name`: trimmed, min 2. `email`: trimmed, required, valid email. `password`: min 8. | "Name must be at least 2 characters"; "Email is required"; "Enter a valid email address"; "Password must be at least 8 characters" (FR-03) |
| `loginSchema` | `email` as above. `password`: required (min 1), no length rule. | "Password is required" |
| `forgotPasswordSchema`, `resendVerificationSchema` | `email` as above. | as above |
| `resetPasswordSchema` | `newPassword`: min 8. The token is not a form field. | as above |
| `changePasswordSchema` | `currentPassword`: required. `newPassword`: min 8. No "must differ" rule (not in Doc 5). | "Current password is required" |
| `updateProfileSchema` | `name`: trimmed, min 2. | as above |
| `createRepoSchema` | `starterTemplate`: required, must be `react`, `node_express`, or `django` (D-05). `repoName`: trimmed, must match `REPO_NAME_PATTERN` and must not be `.` or `..`; an empty value becomes "omitted" so the server default applies (A-45). | "Choose a starter template"; "Use letters, numbers, ".", "-" and "_" only, up to 100 characters" |

`REPO_NAME_PATTERN` is `^[A-Za-z0-9._-]{1,100}$` and is exported from `github.schemas.ts`. `PASSWORD_MIN_LENGTH` (8) is exported from `auth.schemas.ts`.

**Test file:** `frontend/tests/schemas/auth.schemas.test.ts`, `frontend/tests/schemas/github.schemas.test.ts`

---

# 10.6 Auth Hooks

Files: `frontend/src/hooks/auth/*.ts` (Doc 7).

**Rules for every hook in 10.6 – 10.12**
- Cache keys come only from `queryKeys` (10.3.4). HTTP calls come only from `apiRequest` (10.4).
- Queries set `retry` to `shouldRetryQuery`. Mutations set `retry: false`.
- Hooks return TanStack Query results typed with `ApiError` as the error type. They return the unwrapped domain value (for example `data.user`), not the envelope, unless the server `message` is needed.
- Hooks never show toasts or copy. Hooks never navigate, **except** `useLogout` and `useLogoutAll`, where navigation order matters.
- Where a mutation can time out after the server already did the work, `onError` refetches the affected queries (Doc 6, 6.5.3). The affected queries are named in each hook.

## useMe — `frontend/src/hooks/auth/useMe.ts`

| Field | Detail |
|---|---|
| Signature | `useMe(): UseQueryResult<User, ApiError>` |
| Endpoint | EP-11 `GET /users/me` |
| Purpose | The current user, and the app's single "am I logged in" fact. |
| Output | `User` (unwraps `data.user`). |
| Side effects | Cache key `queryKeys.me`, `staleTime: ME_STALE_TIME_MS` (A-65), `retry: shouldRetryQuery`. |
| Rules | A 401 from this query (after the client's refresh attempt failed) is the normal "not logged in" state. Consumers read `error?.status === 401`. Never treat the user as logged in while the query is pending. Never treat a network or timeout error (status 0) as logged out. |
| Edge cases | Valid refresh cookie but expired access cookie (the client refreshes and replays, so this succeeds). Cold start with no cookies (401, no "session expired" notice, see 10.23). Data from a previous user must not survive a logout (the cache is cleared there). |
| Test file | `frontend/tests/hooks/auth/useMe.test.tsx` |

## useLogin — `frontend/src/hooks/auth/useLogin.ts`

| Field | Detail |
|---|---|
| Signature | `useLogin(): UseMutationResult<User, ApiError, LoginInput>` |
| Endpoint | EP-02 `POST /auth/login` with body `{ email, password }` |
| Purpose | Log in and seed the user cache. |
| Output | `User` (unwraps `data.user`). |
| Side effects | On success: `setQueryData(queryKeys.me, user)` and `resetSessionExpiredGuard()`. |
| Rules | Never stores or reads a token. Does not check `emailVerifiedAt` (Q-04, A-39). Does not navigate. A 401 here means wrong credentials and must reach the form, never a refresh (`NO_REFRESH_PATHS`). |
| Edge cases | 429 from `authLimiter` (the page shows it in `root`). Logging in while already logged in from another tab (cookies are simply replaced). |
| Test file | `frontend/tests/hooks/auth/useLogin.test.tsx` |

## useLogout — `frontend/src/hooks/auth/useLogout.ts`

| Field | Detail |
|---|---|
| Signature | `useLogout(): UseMutationResult<void, ApiError, void>` |
| Endpoint | EP-04 `POST /auth/logout`, no body |
| Purpose | End this device's session. |
| Side effects | On success: navigate to `/login` with `replace`, **then** `queryClient.clear()`. |
| Rules | A 401 response means there is already no session, so the hook treats it as success. Any other failure leaves the user logged in, leaves the cache untouched, and surfaces the error so the caller can show "Couldn't log out. Try again." The navigate-then-clear order stops `RequireAuth` from adding a `from` parameter to the login URL. |
| Edge cases | Network failure (still logged in, not cleared). Access token expired at click time (the client refreshes first, then logs out). Called while a form is dirty (the unsaved-changes blocker applies, 10.13). |
| Test file | `frontend/tests/hooks/auth/useLogout.test.tsx` |

## useVerifyEmail — `frontend/src/hooks/auth/useVerifyEmail.ts`

| Field | Detail |
|---|---|
| Signature | `useVerifyEmail(): UseMutationResult<{ emailVerifiedAt: string }, ApiError, { token: string }>` |
| Endpoint | EP-06 `POST /auth/verify-email` with body `{ token }` |
| Purpose | Consume the emailed verification token. |
| Side effects | On success, if `queryKeys.me` is already cached, set its `emailVerifiedAt`. Never create a cache entry that did not exist. |
| Rules | The hook does not deduplicate calls. The page guarantees one call per page load (10.22, PG-05). |
| Edge cases | 400 invalid format; 410 strictly for expired unused tokens. An already-used token for an already-verified user returns 200 soft success with `{ emailVerifiedAt }` (D-11), preventing broken UI on email-client prefetch or page refresh. |
| Test file | `frontend/tests/hooks/auth/useVerifyEmail.test.tsx` |

## useResendVerification — `frontend/src/hooks/auth/useResendVerification.ts`

```ts
export interface ResendVerificationState {
  resend: (email: string) => Promise<void>;
  isPending: boolean;
  isCoolingDown: boolean;
  cooldownSecondsLeft: number;
  message: string | null;   // the server's message from the last success, shown as returned
  error: UiError | null;
}
```

| Field | Detail |
|---|---|
| Signature | `useResendVerification(): ResendVerificationState` |
| Endpoint | EP-07 `POST /auth/resend-verification` with body `{ email }` |
| Purpose | Send a new verification link and own the 60-second UI cooldown, which four places need (PG-01, PG-05, PG-12, `EmailVerificationBanner`). |
| Side effects | A timer that counts down `RESEND_COOLDOWN_MS` after a **successful** send. Each hook instance has its own cooldown (A-53, A-66). |
| Rules | `resend` ignores calls while `isPending` or `isCoolingDown`. `resend` never rejects; failures are stored in `error` (through `mapApiError`), so callers need no try/catch. The server message is stored unchanged in `message`, and the UI adds nothing that reveals whether the account exists (EP-07 answers the same way every time). The cooldown is a UI convenience; the server's 429 is authoritative. The countdown is computed from timestamps, not by decrementing, so it does not drift in a background tab. |
| Edge cases | 429 (shown, no cooldown started). Component unmounts during the request or the countdown (no state update after unmount, and the timer is cleared). Empty email (callers validate first; the hook does not call the API). |
| Test file | `frontend/tests/hooks/auth/useResendVerification.test.tsx` |

## Simple auth hooks

Each follows the shared rules above. None has cache effects unless stated.

| Hook | Signature | Endpoint | On success | Notes |
|---|---|---|---|---|
| `useRegister` | `UseMutationResult<User, ApiError, RegisterInput>` | EP-01 `POST /auth/register` | `setQueryData(queryKeys.me, user)` | Logs the user in immediately; EP-01 sets session cookies on 201 (D-10). Body is exactly `{ name, email, password }`. Unverified banner is shown post-registration. |
| `useForgotPassword` | `UseMutationResult<{ message: string }, ApiError, { email: string }>` | EP-08 `POST /auth/forgot-password` | none | Returns the server `message` unchanged (identical for every email). |
| `useResetPassword` | `UseMutationResult<void, ApiError, { token: string; newPassword: string }>` | EP-09 `POST /auth/reset-password` | none | Session revocation after reset is handled server-side per D-12 (all refresh tokens revoked). |
| `useChangePassword` | `UseMutationResult<void, ApiError, { currentPassword: string; newPassword: string }>` | EP-10 `POST /auth/change-password` | none | The wrong-password case is a 400 (not 401), so it never triggers the session flow. |
| `useUpdateProfile` | `UseMutationResult<User, ApiError, { name: string }>` | EP-12 `PATCH /users/me` | `setQueryData(queryKeys.me, user)` | Only the name is sent. |
| `useLogoutAll` | `UseMutationResult<void, ApiError, void>` | EP-05 `POST /auth/logout-all` | Same as `useLogout`, but navigates with router state `{ notice: 'logged_out_all' }` | A 401 counts as success, as in `useLogout`. |

**Test files:** `frontend/tests/hooks/auth/useRegister.test.tsx`, `useForgotPassword.test.tsx`, `useResetPassword.test.tsx`, `useChangePassword.test.tsx`, `useUpdateProfile.test.tsx`, `useLogoutAll.test.tsx` (all under `frontend/tests/hooks/auth/`).

---

# 10.7 Billing Hooks

Files: `frontend/src/hooks/billing/*.ts` (Doc 7).

## useSubscription — `frontend/src/hooks/billing/useSubscription.ts`

| Field | Detail |
|---|---|
| Signature | `useSubscription(options?: { refetchIntervalMs?: number \| false }): UseQueryResult<SubscriptionStatusResponse, ApiError>` |
| Endpoint | EP-15 `GET /subscriptions/me` |
| Purpose | Subscription status and `hasAccess`. Also what the checkout return page polls. |
| Output | The full `{ subscription, hasAccess }` response. |
| Side effects | Cache key `queryKeys.subscription`. `refetchOnWindowFocus: true`. `refetchInterval` is `options.refetchIntervalMs` or `false`. |
| Rules | `hasAccess` is used exactly as the server sent it. The client never recomputes it from `currentPeriodEnd`, because the user's clock is not trusted. The hook does not implement polling limits; `CheckoutReturnPage` owns them (10.22, PG-08). |
| Edge cases | Never-subscribed user (`subscription: null`). Background refetch failing (keep showing the last data). |
| Test file | `frontend/tests/hooks/billing/useSubscription.test.tsx` |

## useStartCheckout — `frontend/src/hooks/billing/useStartCheckout.ts`

| Field | Detail |
|---|---|
| Signature | `useStartCheckout(): UseMutationResult<{ checkoutUrl: string }, ApiError, void>` |
| Endpoint | EP-13 `POST /subscriptions/checkout`, no body |
| Purpose | Get Chapa's hosted checkout URL. |
| Side effects | `onError`: status 409 or a timeout invalidates `queryKeys.subscription` and `queryKeys.payments` (the server may have created a pending payment). |
| Rules | Sends no price, currency or card data (FR-17). Validates that `checkoutUrl` is an absolute `https:` URL, otherwise throws an `ApiError` with `kind: 'unexpected_response'` (A-67). Does not navigate; `BillingPage` does. |
| Edge cases | 409 "already have an active subscription". 502 from Chapa. A timeout after the payment row was created. |
| Test file | `frontend/tests/hooks/billing/useStartCheckout.test.tsx` |

## useCancelSubscription — `frontend/src/hooks/billing/useCancelSubscription.ts`

| Field | Detail |
|---|---|
| Signature | `useCancelSubscription(): UseMutationResult<Subscription, ApiError, void>` |
| Endpoint | EP-16 `POST /subscriptions/cancel`, no body |
| Purpose | Cancel the subscription. Access continues to `currentPeriodEnd`. |
| Side effects | `onSuccess`, `onError` with status 409, and `onError` with a timeout all invalidate `queryKeys.subscription`. |
| Rules | The UI never assumes the subscription is canceled until the server says so. After any outcome the subscription is refetched, so the card shows the truth. |
| Edge cases | 409 "No active subscription to cancel" (another tab canceled). 502 from Chapa (keep the dialog open). Timeout (the refetch may show it is already canceled). |
| Test file | `frontend/tests/hooks/billing/useCancelSubscription.test.tsx` |

## usePayments — `frontend/src/hooks/billing/usePayments.ts`

| Field | Detail |
|---|---|
| Signature | `usePayments(): UseQueryResult<Payment[], ApiError>` |
| Endpoint | EP-17 `GET /payments` |
| Output | `data.payments`, in the order returned (newest first). |
| Side effects | Cache key `queryKeys.payments`. |
| Rules | No client-side sorting, filtering or pagination. The Chapa reference is never present. |
| Test file | `frontend/tests/hooks/billing/usePayments.test.tsx` |

---

# 10.8 GitHub Hooks

Files: `frontend/src/hooks/github/*.ts` (Doc 7).

## useGitHubConnection — `frontend/src/hooks/github/useGitHubConnection.ts`

| Field | Detail |
|---|---|
| Signature | `useGitHubConnection(): UseQueryResult<GitHubConnectionSummary, ApiError>` |
| Endpoint | EP-20 `GET /github/connection` |
| Output | `{ connected, githubLogin, repo }`. |
| Side effects | Cache key `queryKeys.githubConnection`. `refetchOnWindowFocus: true`. |
| Rules | `repo` can be non-null while `connected` is `false`, because the repo record survives a disconnect (A-07 of Doc 4). Nothing infers "connected" from `repo`. |
| Test file | `frontend/tests/hooks/github/useGitHubConnection.test.tsx` |

## useGitHubConnect — `frontend/src/hooks/github/useGitHubConnect.ts`

| Field | Detail |
|---|---|
| Signature | `useGitHubConnect(): UseMutationResult<string, ApiError, void>` |
| Endpoint | EP-18 `GET /github/connect` |
| Purpose | Get the GitHub OAuth authorize URL. |
| Output | `authorizeUrl` (unwraps `data.authorizeUrl`). |
| Rules | Validates that the URL is an absolute `https:` URL (A-67). Does not navigate; `GitHubSetupPage` calls `window.location.assign`. A 402 (no paid access) is left to the page and the global handler. The permission wording shown next to the button depends on Q-08 and is not decided here. |
| Test file | `frontend/tests/hooks/github/useGitHubConnect.test.tsx` |

## useDisconnectGitHub — `frontend/src/hooks/github/useDisconnectGitHub.ts`

| Field | Detail |
|---|---|
| Signature | `useDisconnectGitHub(): UseMutationResult<void, ApiError, void>` |
| Endpoint | EP-21 `DELETE /github/connection` |
| Side effects | `onSettled` (success or failure) invalidates `queryKeys.githubConnection`. |
| Rules | The hook rethrows a 404 "GitHub is not connected". The page treats that 404 as "already done" and closes the dialog. The hook does not revoke anything at GitHub (A-32 of Doc 5). |
| Test file | `frontend/tests/hooks/github/useDisconnectGitHub.test.tsx` |

## useCreateRepo — `frontend/src/hooks/github/useCreateRepo.ts`

| Field | Detail |
|---|---|
| Signature | `useCreateRepo(): UseMutationResult<Repo, ApiError, CreateRepoInput>` |
| Endpoint | EP-22 `POST /github/repo` with body `{ starterTemplate, repoName? }` (long timeout, applied inside `apiRequest`) |
| Purpose | Create the user's one starter repository. |
| Output | `Repo` (unwraps `data.repo`). |
| Side effects | `onSuccess` invalidates `queryKeys.githubConnection`. `onError` with status 403 or 409, or a timeout, invalidates it too. |
| Rules | `repoName` is omitted from the body when empty so the server default applies (A-24 of Doc 5). `starterTemplate` can be `react`, `node_express`, or `django` (D-05). Does not navigate. |
| Edge cases | 409 name collision and 409 "already have a repo" (the refetch shows which). 403 with the connection row now deleted. Timeout after GitHub created the repo (the refetch shows the repo). |
| Test file | `frontend/tests/hooks/github/useCreateRepo.test.tsx` |

---

# 10.9 Ticket Hooks

Files: `frontend/src/hooks/tickets/*.ts` (Doc 7).

## useCurrentTicket — `frontend/src/hooks/tickets/useCurrentTicket.ts`

| Field | Detail |
|---|---|
| Signature | `useCurrentTicket(): UseQueryResult<Ticket \| null, ApiError>` |
| Endpoint | EP-24 `GET /tickets/current` |
| Output | `data.ticket` (`null` when there is no active ticket). |
| Side effects | Cache key `queryKeys.currentTicket`. `refetchOnWindowFocus: true`. |
| Rules | "Active" means any status except `done` and `abandoned`; that is decided by the server. |
| Test file | `frontend/tests/hooks/tickets/useCurrentTicket.test.tsx` |

## useTicket — `frontend/src/hooks/tickets/useTicket.ts`

| Field | Detail |
|---|---|
| Signature | `useTicket(ticketId: string \| undefined): UseQueryResult<TicketWithSubmissions, ApiError>` |
| Endpoint | EP-25 `GET /tickets/:ticketId` |
| Output | `{ ticket, submissions }` with 0–2 submissions and no diff. |
| Side effects | Cache key `queryKeys.ticket(id)`. Disabled while `ticketId` is undefined. `refetchOnWindowFocus: true`. |
| Rules | A 404 (or a 400 for a malformed ID) is the "Ticket not found" state and is never retried. Works for `done` and `abandoned` tickets. |
| Test file | `frontend/tests/hooks/tickets/useTicket.test.tsx` |

## useAssignTicket — `frontend/src/hooks/tickets/useAssignTicket.ts`

| Field | Detail |
|---|---|
| Signature | `useAssignTicket(): UseMutationResult<Ticket, ApiError, void>` |
| Endpoint | EP-23 `POST /tickets`, no body (long timeout, applied inside `apiRequest`) |
| Purpose | Get the next ticket. It runs Gemini and creates a branch, so it can be slow. |
| Output | `Ticket` (unwraps `data.ticket`). |
| Side effects | `onSuccess`: `setQueryData(queryKeys.ticket(id), { ticket, submissions: [] })` and `setQueryData(queryKeys.currentTicket, ticket)`. `onError` with status 409 or a timeout: invalidate `queryKeys.currentTicket` and `queryKeys.githubConnection`. |
| Rules | Never sends a template choice (the server chooses, Q-09). Does not navigate; the caller navigates to `/tickets/:id`. |
| Edge cases | 409 "already have an active ticket" versus 409 "no repo" (the caller tells them apart from the refetched data, not from message text, see 10.22 PG-06). Timeout after the ticket was created (the refetch shows it). |
| Test file | `frontend/tests/hooks/tickets/useAssignTicket.test.tsx` |

## useStartTicket — `frontend/src/hooks/tickets/useStartTicket.ts`

| Field | Detail |
|---|---|
| Signature | `useStartTicket(ticketId: string): UseMutationResult<Ticket, ApiError, void>` |
| Endpoint | EP-26 `POST /tickets/:ticketId/start`, no body |
| Side effects | `onSuccess`: replace `ticket` inside the `queryKeys.ticket(id)` entry and keep its `submissions`; invalidate `queryKeys.currentTicket`. `onError` with status 409 or a timeout: invalidate both. |
| Rules | Moves `assigned` to `in_progress` only as the server decides. The UI does not flip the phase before the response. |
| Test file | `frontend/tests/hooks/tickets/useStartTicket.test.tsx` |

## useAbandonTicket — `frontend/src/hooks/tickets/useAbandonTicket.ts`

| Field | Detail |
|---|---|
| Signature | `useAbandonTicket(ticketId: string): UseMutationResult<AbandonResult, ApiError, void>` |
| Endpoint | EP-27 `POST /tickets/:ticketId/abandon`, no body (long timeout, applied inside `apiRequest`) |
| Output | `{ abandonedTicketId, newTicket }`. |
| Side effects | `onSuccess`: invalidate `queryKeys.ticket(abandonedTicketId)`. If `newTicket` exists, seed `queryKeys.ticket(newTicket.id)` with `{ ticket: newTicket, submissions: [] }` and set `queryKeys.currentTicket` to `newTicket`. If `newTicket` is `null`, set `queryKeys.currentTicket` to `null`, then invalidate it. `onError` with status 409 or a timeout: invalidate `queryKeys.ticket(ticketId)` and `queryKeys.currentTicket`. |
| Rules | `newTicket: null` is a successful abandon (A-31 of Doc 5), not an error. Does not navigate. |
| Edge cases | 409 after a submission exists (another tab submitted). 403 (GitHub) and 402 (access), which the page turns into a link or banner. |
| Test file | `frontend/tests/hooks/tickets/useAbandonTicket.test.tsx` |

---

# 10.10 Mentor Hooks

Files: `frontend/src/hooks/mentor/*.ts` (Doc 7).

## useMentorMessages — `frontend/src/hooks/mentor/useMentorMessages.ts`

| Field | Detail |
|---|---|
| Signature | `useMentorMessages(ticketId: string \| undefined): UseQueryResult<MentorMessage[], ApiError>` |
| Endpoint | EP-29 `GET /tickets/:ticketId/mentor/messages` |
| Output | `data.messages`, oldest first, for a ticket in any status. |
| Side effects | Cache key `queryKeys.mentor(id)`. Disabled while `ticketId` is undefined. |
| Test file | `frontend/tests/hooks/mentor/useMentorMessages.test.tsx` |

## useSendMentorMessage — `frontend/src/hooks/mentor/useSendMentorMessage.ts`

| Field | Detail |
|---|---|
| Signature | `useSendMentorMessage(ticketId: string): UseMutationResult<{ userMessage: MentorMessage; mentorMessage: MentorMessage }, ApiError, { content: string }>` |
| Endpoint | EP-28 `POST /tickets/:ticketId/mentor/messages` with body `{ content }` (long timeout, applied inside `apiRequest`) |
| Purpose | Send one message and get the mentor's reply. |
| Side effects | `onSuccess`: append `userMessage` then `mentorMessage` to the `queryKeys.mentor(ticketId)` entry (invalidate instead if that entry is not cached). `onError` with status 409: invalidate `queryKeys.ticket(ticketId)`. `onError` with a timeout: invalidate `queryKeys.mentor(ticketId)` so `MentorPanel` can reconcile (A-71). |
| Rules | The body is exactly `{ content }`. It never carries a hint level, an attempt, or a role. The hook does not add the message to the cache before the reply arrives (nothing is stored server-side on failure, A-29 of Doc 5). |
| Edge cases | 429 (limit reached, the panel disables the composer). 502 (retry possible with no duplicate). 409 (ticket not in `in_progress` or `submitted_v1` status — D-04). Timeout after the server stored both messages. |
| Test file | `frontend/tests/hooks/mentor/useSendMentorMessage.test.tsx` |

---

# 10.11 Submission Hooks

Files: `frontend/src/hooks/submissions/*.ts` (Doc 7).

## useSubmission — `frontend/src/hooks/submissions/useSubmission.ts`

```ts
export interface UseSubmissionOptions { includeDiff?: boolean; enabled?: boolean }
export interface UseSubmissionResult {
  query: UseQueryResult<Submission, ApiError>;
  showSlowHint: boolean;       // polling has run for SUBMISSION_POLL_SLOW_AFTER_MS
  pollingStopped: boolean;     // automatic polling stopped after SUBMISSION_POLL_STOP_AFTER_MS
  restartPolling: () => void;  // the "Check again" button
}
```

| Field | Detail |
|---|---|
| Signature | `useSubmission(ticketId: string \| undefined, attempt: SubmissionAttempt, options?: UseSubmissionOptions): UseSubmissionResult` |
| Endpoint | EP-31 `GET /tickets/:ticketId/submissions/:attempt?includeDiff=<boolean>` |
| Purpose | Poll a submission while it is processing, and load its detail and diff afterward. |
| Output | `query.data` is `data.submission`. `diff` is present only when `includeDiff` is `true`. |
| Side effects | Cache key `queryKeys.submission(id, attempt, includeDiff)`. |
| Rules | **Polling.** `refetchInterval` is `false` when: `includeDiff` is `true`, or there is no data yet (the first fetch runs normally), or `status` is `completed` or `failed`, or `pollingStopped` is `true`. Otherwise it is `SUBMISSION_POLL_FAST_MS` until `SUBMISSION_POLL_SLOW_AFTER_MS` has passed since polling started, then `SUBMISSION_POLL_SLOW_MS`. `refetchIntervalInBackground` is `false`, so a hidden tab pauses and refetches on return. **Flags.** `showSlowHint` becomes `true` at `SUBMISSION_POLL_SLOW_AFTER_MS`. `pollingStopped` becomes `true` at `SUBMISSION_POLL_STOP_AFTER_MS`. Both timers start when the first processing status is seen, restart when `ticketId` or `attempt` changes, restart on `restartPolling()`, and are cleared on a terminal status or unmount. **Diff.** The diff query is requested only when the caller passes `includeDiff: true` (the user opened "View diff"). It uses `staleTime: Infinity` and `refetchOnWindowFocus: false`, because a completed submission's diff does not change. The polling query never requests the diff. |
| Edge cases | 404 "Submission not found" (not retried). `attempt` can only be `1` or `2` by type, so there is no third-attempt path. A submission that is already terminal when the page loads (no polling at all). The user returns after hours to an in-flight submission (polling starts again from zero). |
| Test file | `frontend/tests/hooks/submissions/useSubmission.test.tsx` |

## useSubmitWork — `frontend/src/hooks/submissions/useSubmitWork.ts`

| Field | Detail |
|---|---|
| Signature | `useSubmitWork(ticketId: string): UseMutationResult<Submission, ApiError, void>` |
| Endpoint | EP-30 `POST /tickets/:ticketId/submissions`, **no body** (long timeout, applied inside `apiRequest`) |
| Purpose | Submit (attempt 1) or resubmit (attempt 2). The server decides which from the ticket state. |
| Output | `Submission` with status `awaiting_ci` (unwraps `data.submission`). |
| Side effects | `onSuccess`: `setQueryData(queryKeys.submission(ticketId, submission.attempt, false), submission)`; invalidate `queryKeys.ticket(ticketId)` and `queryKeys.currentTicket`. `onError` with status 409 or a timeout: invalidate `queryKeys.ticket(ticketId)`, `queryKeys.currentTicket`, and both non-diff submission keys for the ticket. |
| Rules | Takes no attempt and sends no body. The caller must not assume which attempt was created; it reads `submission.attempt`. A 400 "No commits found on branch…" is a normal user-fixable error and causes no cache change. |
| Edge cases | Double click (the caller disables the button). Timeout after the server created the submission (the refetched ticket shows the new phase and the UI moves on without a duplicate). 409 "Wait for feedback on your first submission before resubmitting" (stale tab). 502 reading GitHub. |
| Test file | `frontend/tests/hooks/submissions/useSubmitWork.test.tsx` |

## useRetrySubmission — `frontend/src/hooks/submissions/useRetrySubmission.ts`

| Field | Detail |
|---|---|
| Signature | `useRetrySubmission(ticketId: string, attempt: SubmissionAttempt): UseMutationResult<Submission, ApiError, void>` |
| Endpoint | EP-32 `POST /tickets/:ticketId/submissions/:attempt/retry`, no body |
| Purpose | Re-run the pipeline for the same failed submission. It is not a new attempt (A-12 of Doc 4). |
| Side effects | `onSuccess`: seed `queryKeys.submission(ticketId, attempt, false)` with the returned submission and invalidate `queryKeys.ticket(ticketId)`. `onError` with status 409 or a timeout: invalidate the same two. |
| Rules | The `attempt` argument must be `TicketPhaseInfo.retryAttempt`. It is never chosen by the user. Retry never changes the ticket status. After success the `SubmissionCard` polls again because the status is back to processing. |
| Edge cases | 409 "Only a failed submission can be retried" (another tab already retried). |
| Test file | `frontend/tests/hooks/submissions/useRetrySubmission.test.tsx` |

---

# 10.12 Profile Hook

## useExperienceProfile — `frontend/src/hooks/profile/useExperienceProfile.ts`

| Field | Detail |
|---|---|
| Signature | `useExperienceProfile(): UseQueryResult<ProfileItem[], ApiError>` |
| Endpoint | EP-34 `GET /profile` |
| Output | `data.items`, newest first, in the order returned. |
| Side effects | Cache key `queryKeys.profile`. |
| Rules | Only completed tickets appear, and that is decided by the server. No client-side filtering, sorting, or pagination. No public or shareable variant (FR-52). |
| Test file | `frontend/tests/hooks/profile/useExperienceProfile.test.tsx` |

---

# 10.13 Cross-Cutting Hooks

Files: `frontend/src/hooks/useSetupProgress.ts`, `useUnsavedChangesWarning.ts`, `useDocumentTitle.ts` (Doc 7).

## getSetupProgress and useSetupProgress — `frontend/src/hooks/useSetupProgress.ts`

```ts
export type SetupStepKey = 'subscribe' | 'connect_github' | 'create_repo' | 'get_ticket';
export type SetupStepStatus = 'done' | 'todo' | 'loading' | 'error';
export interface SetupStep { key: SetupStepKey; status: SetupStepStatus; label: string; detail: string | null }
export interface SetupProgress {
  steps: SetupStep[];            // always four, in this order
  nextStep: SetupStepKey | null;
  setupComplete: boolean;        // steps 1 to 3 are done
  canGetTicket: boolean;         // setupComplete and there is no active ticket
}
export interface QueryStateInput<T> { status: 'pending' | 'error' | 'success'; data: T | undefined }
```

| Field | Detail |
|---|---|
| Signature | `getSetupProgress(input: { subscription: QueryStateInput<SubscriptionStatusResponse>; connection: QueryStateInput<GitHubConnectionSummary>; currentTicket: QueryStateInput<Ticket \| null> }): SetupProgress` (pure) and `useSetupProgress(): SetupProgress & { retry: () => void }` (combines `useSubscription`, `useGitHubConnection`, `useCurrentTicket`). |
| Purpose | Derive the dashboard's four setup steps from the three queries. Steps are derived, never stored. |
| Rules | **Step 1** `subscribe`: `done` when `hasAccess` is `true`; label "Subscribe", or "Subscribe again" when `hasAccess` is `false` and `subscription` is not `null`. **Step 2** `connect_github`: `done` when `connected` is `true` (detail "Connected as @{githubLogin}"); otherwise `todo`, labeled "Reconnect GitHub" when `repo` is not `null`, else "Connect GitHub". **Step 3** `create_repo`: `done` when `repo` is not `null`; label "Create your starter repository". **Step 4** `get_ticket`: `done` when an active ticket exists; label "Get a ticket" (A-74). For every step, `loading` while its query is pending and `error` when it failed. `nextStep` is the first step that is not `done`, or `null` if that step is `loading` or `error` (we cannot tell yet). `retry` refetches only the queries that errored. |
| Edge cases | GitHub disconnected with a repo still present (step 2 is `todo`, step 3 is `done`). Subscription lapsed after setup (step 1 is `todo`, "Subscribe again"). Two queries failing at once. |
| Test file | `frontend/tests/hooks/useSetupProgress.test.tsx` |

## useUnsavedChangesWarning — `frontend/src/hooks/useUnsavedChangesWarning.ts`

| Field | Detail |
|---|---|
| Signature | `useUnsavedChangesWarning(isDirty: boolean): { isBlocked: boolean; confirmLeave: () => void; cancelLeave: () => void }` |
| Purpose | Ask before the user leaves a dirty form (Doc 6, 6.5.6). Used only by `SettingsPage`. |
| Side effects | While `isDirty` is `true`: registers the router's navigation blocker and adds a `beforeunload` listener. Both are removed when `isDirty` becomes `false` or the component unmounts. |
| Rules | In-app navigation to a different pathname sets `isBlocked` to `true`; the page renders `ConfirmDialog` ("You have unsaved changes." with Leave and Stay). `confirmLeave` lets the navigation continue; `cancelLeave` cancels it. A change that only alters the query string or hash is never blocked. Navigation to `/login` caused by session expiry (router state `notice: 'session_expired'`) is never blocked (A-53 of Doc 6). `beforeunload` calls `event.preventDefault()` and sets `event.returnValue = ''`. The page must reset the form's dirty state before navigating after a successful save. |
| Edge cases | Dirty state toggling quickly. Logout from the header menu while dirty (blocked like any other navigation). Unmount while blocked. |
| Test file | `frontend/tests/hooks/useUnsavedChangesWarning.test.tsx` |

## useDocumentTitle and useFocusPageHeading — `frontend/src/hooks/useDocumentTitle.ts`

| Field | Detail |
|---|---|
| Signature | `useDocumentTitle(title: string): void` and `useFocusPageHeading(): void` |
| Purpose | Route-change accessibility from Doc 6, 6.5.8. Both live in this one file so no new file is needed. |
| Rules | `useDocumentTitle` sets `document.title` to `"{title} · Work Simulator"` in an effect. Each page passes its title (listed in 10.22). `useFocusPageHeading` is called by both layouts. When `location.pathname` changes (not on the first load, and not on a search-only or hash-only change) it focuses the first `h1` inside `main`. Pages give that heading `tabIndex={-1}`. If there is no `h1`, it does nothing. |
| Edge cases | Replace-navigation that keeps the same pathname (for example stripping `?github=` params) must not steal focus. |
| Test file | `frontend/tests/hooks/useDocumentTitle.test.tsx` |

---

# 10.14 Routing Components

Files: `frontend/src/routes/RequireAuth.tsx`, `PublicOnly.tsx`, `RootRedirect.tsx` (Doc 7). They are wrappers, not pages. The router library is not named in the docs (A-57), so navigation is described as `Navigate` with `replace`, meaning the router's redirect element.

## RequireAuth — `frontend/src/routes/RequireAuth.tsx`

| Field | Detail |
|---|---|
| Signature | `RequireAuth(props: { children: ReactNode }): JSX.Element` |
| Purpose | Guard every protected route (PG-06 to PG-12). |
| Output | While `useMe` is pending: `FullPageLoader`. Error with status 401: redirect to `buildLoginRedirect(pathname + search)` with `replace`. Any other error (status 0, 5xx): a centered `ErrorState` with a Retry button that calls `refetch`. Success: `children`. |
| Rules | A network failure never logs the user out and never redirects. A 401 on first load never shows the "session expired" notice (10.23). Only `useMe` decides; it does not read cookies. |
| Edge cases | Deep link with a query string (kept in `from`). The access cookie expired but the refresh cookie is valid (the client refreshes, so the user sees the page, not the login). Session ends while the page is open (the session-expiry wiring navigates, 10.23). |
| Test file | `frontend/tests/routes/RequireAuth.test.tsx` |

## PublicOnly — `frontend/src/routes/PublicOnly.tsx`

| Field | Detail |
|---|---|
| Signature | `PublicOnly(props: { children: ReactNode }): JSX.Element` |
| Purpose | Keep logged-in users off `/login`, `/register` and `/forgot-password`. |
| Output | While `useMe` is pending: `FullPageLoader`. Success: `Navigate` with `replace` to `getSafeRedirectPath(from, '/dashboard')`. Any error, including 401 and network failure: `children`. |
| Rules | The redirect honors a safe `from` value. This matters because `useLogin` seeds the `me` cache, which makes `PublicOnly` redirect at the same moment `LoginPage` navigates, and both must land in the same place. Not used on `/reset-password` or `/verify-email`. |
| Test file | `frontend/tests/routes/PublicOnly.test.tsx` |

## RootRedirect — `frontend/src/routes/RootRedirect.tsx`

| Field | Detail |
|---|---|
| Signature | `RootRedirect(): JSX.Element` |
| Purpose | Handle `/`. There is no landing page in V1 (A-38 of Doc 6). |
| Output | Pending: `FullPageLoader`. Success: `Navigate` to `/dashboard` with `replace`. Error: `Navigate` to `/login` with `replace` (no `from`). |
| Test file | `frontend/tests/routes/RootRedirect.test.tsx` |

---

# 10.15 Layout Components

Files: `frontend/src/components/layout/*.tsx` (Doc 7).

## AuthLayout — `frontend/src/components/layout/AuthLayout.tsx`

| Field | Detail |
|---|---|
| Signature | `AuthLayout(props: { children: ReactNode }): JSX.Element` |
| Purpose | The centered-card shell for PG-01 to PG-05, and PG-13 when logged out. |
| Output | A centered container with `<main id="main-content">` holding `children`. No navigation. |
| Side effects | Calls `useFocusPageHeading()`. |
| Rules | Contains no third-party scripts, images or external links, so token URLs on PG-04 and PG-05 cannot leak through a referrer (Doc 6, 6.5.9). |
| Test file | `frontend/tests/components/layout/AuthLayout.test.tsx` |

## AppLayout — `frontend/src/components/layout/AppLayout.tsx`

| Field | Detail |
|---|---|
| Signature | `AppLayout(props: { children: ReactNode }): JSX.Element` |
| Purpose | The shell for PG-06 to PG-12, and PG-13 when logged in. |
| Output | In order: a "Skip to main content" link (first focusable element, target `#main-content`), the header, `EmailVerificationBanner`, `SubscriptionBanner`, then `<main id="main-content">` with `children`. The header has the brand link (to `/dashboard`); from `md` up the links Dashboard, Ticket (only when a current ticket exists, to `/tickets/:id`), Profile, and a user menu (GitHub, Billing, Settings, Log out); below `md` a menu button opens a Sheet with every link. The active link has `aria-current="page"`. |
| Side effects | Calls `useFocusPageHeading()`, `useCurrentTicket()` (only for the Ticket link), and `useLogout()`. |
| Rules | The Ticket link is hidden while `useCurrentTicket` is loading, failed, or `null`; a failure there never shows an error. The Sheet closes on navigation. Log out calls `useLogout`; on a non-401 failure it shows the toast "Couldn't log out. Try again." and stays on the page. Nothing here blocks rendering `children`. |
| Edge cases | Log out while a Settings form is dirty (the blocker asks first). Very long user names (truncate visually, keep the full text in the accessible name). |
| Test file | `frontend/tests/components/layout/AppLayout.test.tsx` |

## FullPageLoader — `frontend/src/components/layout/FullPageLoader.tsx`

| Field | Detail |
|---|---|
| Signature | `FullPageLoader(): JSX.Element` |
| Purpose | The only full-page spinner in the app (Doc 6, 6.5.4). |
| Output | A centered spinner in an element with `role="status"` and screen-reader-only text "Loading". |
| Rules | Used only by `RequireAuth`, `PublicOnly`, `RootRedirect` and `NotFoundPage` while `useMe` is pending. Never used for data loading on a page (those use skeletons). |
| Test file | `frontend/tests/components/layout/FullPageLoader.test.tsx` |

## EmailVerificationBanner — `frontend/src/components/layout/EmailVerificationBanner.tsx`

| Field | Detail |
|---|---|
| Signature | `EmailVerificationBanner(): JSX.Element \| null` |
| Purpose | Nudge unverified users without blocking anything (A-39 of Doc 6, Q-04). |
| Output | `null` unless `useMe` has data with `emailVerifiedAt === null`. Otherwise a banner "Verify your email" with a Resend button. The button is disabled while pending and during the cooldown, where its label shows the seconds left. The server's message appears in a `role="status"` region. Errors show inline. |
| Side effects | Uses `useResendVerification()` with the user's own email. |
| Rules | Not dismissible (nothing is persisted, A-53). Never gates any action. |
| Test file | `frontend/tests/components/layout/EmailVerificationBanner.test.tsx` |

## SubscriptionBanner — `frontend/src/components/layout/SubscriptionBanner.tsx`

| Field | Detail |
|---|---|
| Signature | `SubscriptionBanner(): JSX.Element \| null` |
| Purpose | Tell the user about a failed, canceled or ended subscription (FR-22). |
| Output | `null` while loading or on error, and when `getSubscriptionView(...).showsBanner` is `false`. Otherwise an Alert with a link to `/billing`. Text by `kind`: `past_due_access` "Your last payment failed. Your access ends {date}."; `past_due_ended` "Your last payment failed and your access has ended."; `canceled_access` "Your subscription is canceled. Access ends {date}."; `ended` "Your subscription has ended. Subscribe again to start or submit tickets." (A-74). |
| Rules | Never offers a payment action for `past_due` (Q-15). Uses `formatDate`. Shares the `queryKeys.subscription` cache with the rest of the app, so it adds no extra request. |
| Test file | `frontend/tests/components/layout/SubscriptionBanner.test.tsx` |

---

# 10.16 Common Components

Files: `frontend/src/components/common/*.tsx` (Doc 7).

## PasswordInput — `frontend/src/components/common/PasswordInput.tsx`

| Field | Detail |
|---|---|
| Signature | `PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>` where `PasswordInputProps` is the shadcn `Input` props without `type`, plus a required `autoComplete` of `'current-password'` or `'new-password'`. |
| Purpose | A password field with a show/hide toggle, compatible with react-hook-form's `register`. |
| Output | An `Input` plus a `type="button"` toggle with the accessible name "Show password" or "Hide password" and `aria-pressed`. |
| Rules | Starts hidden. The toggle never submits the form. The visible state is never persisted. Never prefilled. |
| Test file | `frontend/tests/components/common/PasswordInput.test.tsx` |

## FormRootError — `frontend/src/components/common/FormRootError.tsx`

| Field | Detail |
|---|---|
| Signature | `FormRootError(props: { message?: string \| null }): JSX.Element \| null` |
| Purpose | Show a form's `errors.root` message. |
| Output | `null` when there is no message. Otherwise an Alert with `role="alert"`. |
| Rules | Text is rendered as text. |
| Test file | `frontend/tests/components/common/FormRootError.test.tsx` |

## SubmitButton — `frontend/src/components/common/SubmitButton.tsx`

| Field | Detail |
|---|---|
| Signature | `SubmitButton(props: SubmitButtonProps): JSX.Element` with `isPending: boolean`, `pendingLabel: string`, `children`, and optional `type`, `variant`, `disabled`, `onClick`. |
| Purpose | Every action button that runs a mutation. |
| Output | A `Button` that is `disabled` and `aria-busy="true"` while `isPending` (or when `disabled`), shows a spinner (`aria-hidden`), and shows `pendingLabel` instead of `children`. |
| Rules | It is the double-submit guard. Pages must not re-enable it before the mutation settles. `type` defaults to `submit`. |
| Test file | `frontend/tests/components/common/SubmitButton.test.tsx` |

## ErrorState — `frontend/src/components/common/ErrorState.tsx`

| Field | Detail |
|---|---|
| Signature | `ErrorState(props: { message: string; onRetry?: () => void; retryLabel?: string }): JSX.Element` |
| Purpose | An inline failure block inside one card or section, so one failure never blanks a page (Doc 6, 6.5.4). |
| Output | The message and, when `onRetry` is given, a Retry button (default label "Retry"). |
| Test file | `frontend/tests/components/common/ErrorState.test.tsx` |

## EmptyState — `frontend/src/components/common/EmptyState.tsx`

| Field | Detail |
|---|---|
| Signature | `EmptyState(props: { title: string; description?: string; children?: ReactNode }): JSX.Element` |
| Purpose | A short explanation plus one optional next action (passed as `children`). |
| Test file | `frontend/tests/components/common/EmptyState.test.tsx` |

## StatusBadge — `frontend/src/components/common/StatusBadge.tsx`

```ts
export type StatusBadgeProps =
  | { domain: 'subscription'; kind: SubscriptionViewKind }
  | { domain: 'payment'; status: PaymentStatus }
  | { domain: 'ticket_phase'; phase: TicketPhaseKey }
  | { domain: 'ticket_status'; status: TicketStatus }
  | { domain: 'submission'; status: SubmissionStatus }
  | { domain: 'ci'; passed: boolean | null }
  | { domain: 'verification'; verified: boolean };
```

| Field | Detail |
|---|---|
| Signature | `StatusBadge(props: StatusBadgeProps): JSX.Element` |
| Purpose | One place for every status label in the app. |
| Output | A `Badge` with **text** and a decorative icon. Labels: `subscription` uses "Not subscribed", "Active", "Renewal pending", "Payment failed" (both `past_due_*`), "Canceled", "Ended"; `payment` uses "Pending", "Succeeded", "Failed"; `ticket_phase` uses `TICKET_PHASE_LABELS` (exported from `ticket-phase.ts`, the labels in 10.5); `ticket_status` uses `getTicketStatusLabel`; `submission` uses "Waiting for tests" (`awaiting_ci`), "Evaluating", "Completed", "Failed"; `ci` uses "Tests passed", "Tests failed", "Tests pending"; `verification` uses "Verified", "Not verified". |
| Rules | Meaning is never carried by color alone (Doc 6, 6.5.8). An unknown value renders its raw text, never throws. |
| Test file | `frontend/tests/components/common/StatusBadge.test.tsx` |

## ConfirmDialog — `frontend/src/components/common/ConfirmDialog.tsx`

| Field | Detail |
|---|---|
| Signature | `ConfirmDialog(props: ConfirmDialogProps): JSX.Element` with `open: boolean`, `onOpenChange: (open: boolean) => void`, `title: string`, `description: ReactNode`, `confirmLabel: string`, `cancelLabel?: string` (default "Cancel"), `onConfirm: () => void`, `isPending: boolean`, `errorMessage?: string \| null`, `destructive?: boolean`. |
| Purpose | Confirmation for every destructive or irreversible action (Doc 6, 6.5.10). Wraps shadcn `AlertDialog`. |
| Output | A dialog with a title, description, an optional error region (`role="alert"`), a Cancel button and a confirm button. |
| Side effects | None itself. `onConfirm` starts the caller's mutation. |
| Rules | 1) The confirm button's click handler calls `event.preventDefault()` and then `onConfirm()`. Radix's action button closes the dialog by default, and this dialog must stay open until the request settles. The caller closes it with `onOpenChange(false)`. 2) While `isPending` is `true`, `onOpenChange(false)` from Esc or Cancel is ignored, and the confirm button uses the pending state. 3) Clicking outside does not close it. 4) A failure leaves the dialog open, shows `errorMessage`, and re-enables confirm. 5) Focus starts on Cancel, and returns to the trigger on close. If the trigger no longer exists, the caller moves focus to the page `h1`. 6) `destructive` gives the confirm button the destructive variant. |
| Edge cases | Double click on confirm (one `onConfirm` call while pending). The dialog unmounting during a request. |
| Test file | `frontend/tests/components/common/ConfirmDialog.test.tsx` |

## ExternalLink — `frontend/src/components/common/ExternalLink.tsx`

| Field | Detail |
|---|---|
| Signature | `ExternalLink(props: { href: string \| null \| undefined; children: ReactNode; className?: string }): JSX.Element` |
| Purpose | Every link that leaves the app (repo, branch, pull request, CI run). |
| Output | An anchor with `target="_blank"`, `rel="noopener noreferrer"` and screen-reader-only text "(opens in a new tab)". If `href` is missing or its parsed protocol is not `http:` or `https:`, it renders the children as plain text with no anchor. |
| Rules | API-supplied URLs such as `prUrl` and `ciRunUrl` are untrusted (A-68). A `javascript:` or `data:` value must never become a link. |
| Test file | `frontend/tests/components/common/ExternalLink.test.tsx` |

## CopyButton — `frontend/src/components/common/CopyButton.tsx`

| Field | Detail |
|---|---|
| Signature | `CopyButton(props: { text: string; label: string }): JSX.Element` |
| Purpose | Copy a short text, for the git commands on the ticket page. |
| Output | A button whose accessible name is `label` (for example "Copy git fetch command"). After a click, a polite live region says "Copied" for `COPY_FEEDBACK_MS`, or "Couldn't copy" if the clipboard call fails or is unavailable. |
| Rules | Never throws. Uses the clipboard API only when present. |
| Test file | `frontend/tests/components/common/CopyButton.test.tsx` |

---

# 10.17 Billing Components

Files: `frontend/src/components/billing/*.tsx` (Doc 7).

## SubscriptionCard — `frontend/src/components/billing/SubscriptionCard.tsx`

| Field | Detail |
|---|---|
| Signature | `SubscriptionCard(props: { data: SubscriptionStatusResponse; isSubscribing: boolean; subscribeError: UiError \| null; onSubscribe: () => void; onCancelClick: () => void }): JSX.Element` |
| Purpose | Show the subscription case and its one action (Doc 6, PG-07 table). |
| Output | A `StatusBadge` (`domain: 'subscription'`), one line of text, and at most one button, all chosen from `getSubscriptionView(data)`. `subscribe` shows "Subscribe" (pending: "Opening Chapa…") with the note "You'll pay on Chapa's secure page. Work Simulator never sees your card details." `cancel` shows "Cancel subscription" as a destructive button. Text by `kind`: `never` "Not subscribed"; `active` "Next billing date: {periodEnd}"; `renewal_pending` "Your billing period ended {periodEnd}. Waiting for Chapa to confirm the renewal."; `past_due_access` "Payment failed. Your access ends {periodEnd}."; `past_due_ended` "Payment failed. Your access has ended."; `canceled_access` "Access ends {periodEnd}."; `ended` "Subscription ended {periodEnd}."; `unknown` no text. |
| Rules | Never shows a price (Q-14). Never shows a button for `past_due_*` (Q-15). `isSubscribing` disables the button and stays `true` until the page unloads, so a second click cannot start a second checkout. `subscribeError` shows inline through `mapApiError`'s message. |
| Test file | `frontend/tests/components/billing/SubscriptionCard.test.tsx` |

## PaymentHistory — `frontend/src/components/billing/PaymentHistory.tsx`

| Field | Detail |
|---|---|
| Signature | `PaymentHistory(props: { payments: Payment[] }): JSX.Element` |
| Purpose | Payment history, newest first as returned. |
| Output | Empty list: `EmptyState` "No payments yet." Otherwise a table from `md` up and one card per payment below `md`. Columns: date (`paidAt`, or `createdAt` when `paidAt` is `null`), amount from `formatAmount`, status from `StatusBadge` (`domain: 'payment'`). |
| Rules | The table and the cards are two renderings of the same data; only one is visible at a time, and the hidden one is not exposed to screen readers. No sorting, no pagination. |
| Test file | `frontend/tests/components/billing/PaymentHistory.test.tsx` |

---

# 10.18 GitHub Components

Files: `frontend/src/components/github/*.tsx` (Doc 7).

## GitHubConnectionCard — `frontend/src/components/github/GitHubConnectionCard.tsx`

| Field | Detail |
|---|---|
| Signature | `GitHubConnectionCard(props: { connection: GitHubConnectionSummary; hasAccess: boolean; oauthResult: GitHubOAuthResult \| null; onDismissResult: () => void; isConnecting: boolean; connectError: UiError \| null; onConnect: () => void; onDisconnectClick: () => void }): JSX.Element` |
| Purpose | Card 1 of `GitHubSetupPage` (Doc 6, PG-09). |
| Output | The OAuth result alert when `oauthResult` is set (success: "GitHub connected." error: `getGitHubOAuthErrorMessage(reason)` plus a Connect button). Then either the not-connected view (explanation, a Connect button) or the connected view ("Connected as @{githubLogin}" and a Disconnect button). |
| Rules | The Connect button is disabled when `hasAccess` is `false`, with the visible reason "An active subscription is required." and a link to `/billing`. While `isConnecting` the label is "Redirecting to GitHub…". The permission wording depends on Q-08 and is one constant string in this file. A success alert has `role="status"`; an error alert has `role="alert"`. An unknown `reason` is never echoed. |
| Test file | `frontend/tests/components/github/GitHubConnectionCard.test.tsx` |

## RepoCreateForm — `frontend/src/components/github/RepoCreateForm.tsx`

| Field | Detail |
|---|---|
| Signature | `RepoCreateForm(props: { onSubmit: (values: CreateRepoInput) => Promise<void>; isPending: boolean; error: UiError \| null; blocked: { message: string; linkTo: string; linkLabel: string } \| null }): JSX.Element` |
| Purpose | Template choice and repository name (FR-27, FR-28). |
| Output | When `blocked` is set: the message and its link, no form. Otherwise a react-hook-form form with `createRepoSchema`: a radio group (React, Node/Express, Django, none selected by default), a repo name field prefilled with `work-simulator`, a `FormRootError` for `error.message`, and a `SubmitButton` ("Create repository", pending "Creating repository…"). |
| Rules | Fields are disabled while pending. When `error.status` becomes 409, focus moves to the repo name field. On a 502 the form keeps its values so the user can retry. Django is supported alongside React and Node/Express (D-05); Voxide is deferred to V2. |
| Test file | `frontend/tests/components/github/RepoCreateForm.test.tsx` |

## RepoSummary — `frontend/src/components/github/RepoSummary.tsx`

| Field | Detail |
|---|---|
| Signature | `RepoSummary = forwardRef<HTMLHeadingElement, { repo: Repo }>` |
| Purpose | Show the created repository. |
| Output | A heading (with `tabIndex={-1}`, so the page can focus it after creation), the repo name as an `ExternalLink` (`buildRepoUrl`), the template, and the default branch. |
| Test file | `frontend/tests/components/github/RepoSummary.test.tsx` |

---

# 10.19 Dashboard Components

Files: `frontend/src/components/dashboard/*.tsx` (Doc 7).

## SetupChecklist — `frontend/src/components/dashboard/SetupChecklist.tsx`

| Field | Detail |
|---|---|
| Signature | `SetupChecklist(props: { progress: SetupProgress; onRetry: () => void }): JSX.Element` |
| Purpose | The first-run path: Subscribe, Connect GitHub, Create repository, Get a ticket. |
| Output | When `progress.setupComplete` is `true`: a one-line summary "Setup complete: subscribed, GitHub connected, repository ready." Otherwise the four steps, each showing its label, detail, and status as text with an icon. The step equal to `nextStep` shows the primary action: `subscribe` a link to `/billing`, `connect_github` and `create_repo` a link to `/github`. Step 4 never shows a button here. A step with status `loading` shows a skeleton. A step with status `error` shows `ErrorState` with Retry (`onRetry`). |
| Rules | The only "Get ticket" button lives in `CurrentTicketCard` (A-64). |
| Test file | `frontend/tests/components/dashboard/SetupChecklist.test.tsx` |

## CurrentTicketCard — `frontend/src/components/dashboard/CurrentTicketCard.tsx`

| Field | Detail |
|---|---|
| Signature | `CurrentTicketCard(props: { query: { status: 'pending' \| 'error' \| 'success'; ticket: Ticket \| null \| undefined; error: UiError \| null; refetch: () => void }; canGetTicket: boolean; getBlockedReason: string \| null; isGetting: boolean; getError: UiError \| null; getErrorLink: { to: string; label: string } \| null; onGetTicket: () => void }): JSX.Element` |
| Purpose | Show the active ticket, or the one place to get the next ticket. |
| Output | Pending: a skeleton. Error: `ErrorState` with Retry. A ticket: its title, category and difficulty badges (as given, A-50), `StatusBadge` (`domain: 'ticket_status'`), and a "Continue" link to `/tickets/{id}`. No ticket and `canGetTicket`: "Get your next ticket" button (pending "Getting your ticket…"). No ticket and not `canGetTicket`: the text `getBlockedReason`. `getError` shows inline with `getErrorLink` as a link when present. |
| Rules | Uses the coarse label from `getTicketStatusLabel`, because EP-24 has no submissions (A-69). The button is `SubmitButton`, so it cannot be double-clicked. |
| Test file | `frontend/tests/components/dashboard/CurrentTicketCard.test.tsx` |

---

# 10.20 Ticket Components

Files: `frontend/src/components/ticket/*.tsx` (Doc 7). Layout and copy are in Doc 6, PG-10. Every component here renders API text as text (A-46).

## TicketHeader — `frontend/src/components/ticket/TicketHeader.tsx`

| Field | Detail |
|---|---|
| Signature | `TicketHeader(props: { ticket: Ticket; phase: TicketPhaseInfo }): JSX.Element` |
| Output | The `h1` (`tabIndex={-1}`) with the ticket title, `StatusBadge` (`domain: 'ticket_phase'`), and category and difficulty as badges, shown as given (A-50). |
| Test file | `frontend/tests/components/ticket/TicketHeader.test.tsx` |

## TicketActionBar — `frontend/src/components/ticket/TicketActionBar.tsx`

| Field | Detail |
|---|---|
| Signature | `TicketActionBar(props: { phase: TicketPhaseInfo; hasAccess: boolean; pendingAction: TicketPrimaryAction \| null; error: UiError \| null; onAction: (action: TicketPrimaryAction) => void }): JSX.Element` |
| Purpose | One line saying what to do now, and the one primary button for the current phase. |
| Output | The message for `phase.key` and, if `phase.primaryAction` is set, its button: `start` "Start working" (pending "Starting…"); `submit` "Submit for feedback" (pending "Submitting…") with the helper "Your first submission gets feedback only, no score. You can then revise and resubmit once for your final score."; `resubmit` "Resubmit for final score" (pending "Submitting…"); `retry` "Retry review" (pending "Retrying…"); `get_next` "Get next ticket" (pending "Getting your ticket…"). Processing phases (`first_review_processing`, `final_review_processing`, `final_review_finalizing`) show a `role="status"` message and no button. |
| Rules | The component never calls a mutation; it calls `onAction`, and the page decides (including the resubmit confirmation). All buttons are disabled while any `pendingAction` is set. When `hasAccess` is `false` the button is disabled and the text "An active subscription is required." with a link to `/billing` is shown. `error` renders inline; `error.action` of `go_billing` or `reconnect_github` adds the matching link (`/billing`, `/github`). |
| Edge cases | A phase with no primary action and no processing (`abandoned`): message only. |
| Test file | `frontend/tests/components/ticket/TicketActionBar.test.tsx` |

## TicketDetails — `frontend/src/components/ticket/TicketDetails.tsx`

| Field | Detail |
|---|---|
| Signature | `TicketDetails(props: { ticket: Ticket }): JSX.Element` |
| Output | The scenario (whitespace preserved), the touched files as code-style paths, the acceptance criteria and the test checklist as read-only lists (FR-32). |
| Rules | The lists are static and have no checkboxes. An empty array hides that section. |
| Test file | `frontend/tests/components/ticket/TicketDetails.test.tsx` |

## BranchInstructions — `frontend/src/components/ticket/BranchInstructions.tsx`

| Field | Detail |
|---|---|
| Signature | `BranchInstructions(props: { repoFullName: string; branchName: string }): JSX.Element` and `shellQuote(value: string): string` (exported for tests). |
| Output | An `ExternalLink` to the repo (`buildRepoUrl`) and to the branch (`buildBranchUrl`), and two commands, `git fetch origin` and `git checkout {quoted branch}`, each with a `CopyButton`. |
| Rules | The branch name is passed through `shellQuote` (single-quote wrapping, with any `'` inside escaped) before it goes into the copied command. If a builder returns `null`, the name shows as plain text. |
| Edge cases | Branch names with slashes, spaces or quotes. |
| Test file | `frontend/tests/components/ticket/BranchInstructions.test.tsx` |

## MentorPanel — `frontend/src/components/ticket/MentorPanel.tsx`

```ts
export interface PendingMentorMessage {
  content: string;
  status: 'sending' | 'failed';
  baseCount: number;        // messages.length when the send started
  error: UiError | null;
}
```

| Field | Detail |
|---|---|
| Signature | `MentorPanel(props: { ticketId: string; mentor: MentorAvailability; hasAccess: boolean }): JSX.Element` |
| Purpose | The mentor tab: history, composer, and the send flow. |
| Side effects | Uses `useMentorMessages(ticketId)` and `useSendMentorMessage(ticketId)`. Holds local state `pending: PendingMentorMessage \| null` and `limitReached: string \| null`. |
| Rules | **Composer availability**, in this order: `mentor === 'read_only'` hides the composer; `hasAccess` false disables it with "An active subscription is required."; `not_started` disables it with "Start the ticket to use the mentor."; `unavailable_after_submit` disables it with "The mentor is only available while the ticket is in progress or revision (D-04)."; `limitReached` disables it with the server's message. **Send:** `handleSend(content)` ignores the call while a send is `sending`, records `baseCount = messages.length`, sets `pending` to `sending`, then awaits the mutation. On success it clears `pending`. On 429 it clears `pending` and sets `limitReached` to the server message. On any other failure it sets `pending.status` to `failed` with the `UiError`. **Retry** calls `handleSend(pending.content)` and is offered only when `mentor === 'enabled'`. **Reconciliation (A-71):** if a failed send was a timeout, and the refetched transcript has at least `baseCount + 2` messages, the message actually went through, so `pending` is cleared and no Retry is offered. Below the composer: "Your mentor conversation is included in your final review." (FR-40). The empty transcript shows the mentor introduction from Doc 6. |
| Edge cases | Send, then the ticket leaves `in_progress` or `submitted_v1` (409): `pending` becomes `failed` and Retry is hidden. Two sends in quick succession (the second is ignored). The tab closed while sending (the message is lost; nothing was stored, A-53). |
| Test file | `frontend/tests/components/ticket/MentorPanel.test.tsx` |

## MentorMessageList — `frontend/src/components/ticket/MentorMessageList.tsx`

| Field | Detail |
|---|---|
| Signature | `MentorMessageList(props: { messages: MentorMessage[]; pending: PendingMentorMessage \| null; canRetry: boolean; onRetry: () => void }): JSX.Element` |
| Output | A container with `role="log"` and `aria-live="polite"`. Each message is labeled "You" or "Mentor" in text, with content shown as plain text and whitespace preserved. A pending message shows last, in a pending style, with "Mentor is thinking…" while `sending`, or "Not sent" and a Retry button (when `canRetry`) when `failed`. |
| Rules | Mentor replies are never rendered as HTML or Markdown (A-46, Q-17). The list scrolls the newest message into view without smooth scrolling when reduced motion is preferred. |
| Test file | `frontend/tests/components/ticket/MentorMessageList.test.tsx` |

## MentorComposer — `frontend/src/components/ticket/MentorComposer.tsx`

| Field | Detail |
|---|---|
| Signature | `MentorComposer(props: { disabledReason: string \| null; isSending: boolean; maxChars: number \| null; onSend: (content: string) => void }): JSX.Element` |
| Output | A labeled textarea ("Message to the mentor"), a Send button, and, when `disabledReason` is set, that reason as visible text linked with `aria-describedby`. |
| Rules | Enter inserts a newline. Sending is by the Send button only (no custom shortcuts in V1). The value is trimmed before sending. Send is disabled when the trimmed value is empty, when `isSending` or `disabledReason` is set, or when a known `maxChars` is exceeded. The character counter shows only when `maxChars` is not `null` (A-47, Q-10b). The textarea clears after `onSend` is called, because the text moves into the pending message. |
| Test file | `frontend/tests/components/ticket/MentorComposer.test.tsx` |

## SubmissionsPanel — `frontend/src/components/ticket/SubmissionsPanel.tsx`

| Field | Detail |
|---|---|
| Signature | `SubmissionsPanel(props: { ticketId: string; submissions: Submission[]; phase: TicketPhaseInfo; hasAccess: boolean; retryingAttempt: SubmissionAttempt \| null; onRetry: (attempt: SubmissionAttempt) => void; onSettled: () => void }): JSX.Element` |
| Output | One `SubmissionCard` per submission, ordered by `attempt`. With no submissions, an `EmptyState` "No submissions yet. Push your work to your ticket branch, then submit." |
| Rules | A card's Retry is enabled only when `phase.retryAttempt` equals its attempt and `hasAccess` is `true`. |
| Test file | `frontend/tests/components/ticket/SubmissionsPanel.test.tsx` |

## SubmissionCard — `frontend/src/components/ticket/SubmissionCard.tsx`

| Field | Detail |
|---|---|
| Signature | `SubmissionCard(props: { ticketId: string; submission: Submission; canRetry: boolean; isRetrying: boolean; onRetry: () => void; onSettled: () => void }): JSX.Element` |
| Purpose | One attempt: status, CI result, links, the evaluation, and the diff. |
| Side effects | Calls `useSubmission(ticketId, attempt, { enabled: status is awaiting_ci or evaluating })` to poll. Calls `useSubmission(ticketId, attempt, { includeDiff: true, enabled: diffOpen })` when the diff is opened. |
| Output | A heading: attempt 1 is "Attempt 1 — First review: feedback only, not scored"; attempt 2 is "Attempt 2 — Final review". The submitted time (`formatDateTime`), a `StatusBadge` for the submission and one for CI (`domain: 'ci'`), `ExternalLink`s to the pull request and the CI run. By status: `awaiting_ci` shows "Waiting for GitHub Actions to run your tests."; `evaluating` shows "The evaluator is reviewing your code and test results." (both in a `role="status"` region); after `showSlowHint`, add "This is taking longer than usual. You can leave this page; your submission is not lost."; when `pollingStopped`, show a "Check again" button (`restartPolling`); `failed` shows `failureReason` as text and, when `canRetry`, a "Retry review" button; `completed` shows `EvaluationView`. A "View diff" button (for `completed` or `failed`) opens the diff section (`aria-expanded`), which shows a skeleton, an `ErrorState` on failure, or `DiffViewer`. |
| Rules | The card shows the polled data when it exists and the `submission` prop otherwise. When the polled status first becomes `completed` or `failed`, it calls `onSettled()` exactly once so the page refetches the ticket. `failureReason` is text. It never shows a score for attempt 1. The submission is never displayed as lost (FR-49). |
| Test file | `frontend/tests/components/ticket/SubmissionCard.test.tsx` |

## EvaluationView — `frontend/src/components/ticket/EvaluationView.tsx`

| Field | Detail |
|---|---|
| Signature | `EvaluationView(props: { evaluation: Evaluation; attempt: SubmissionAttempt }): JSX.Element` |
| Output | The feedback text. For `attempt` 1: the label "Not scored". For `attempt` 2 with `scores`: `ScoreBreakdown`. For `attempt` 2 with `scores: null`: "Score unavailable" (a data problem that must not crash the page). |
| Rules | **Attempt 1 never renders scores, even if the data contains them.** Feedback is plain text. |
| Test file | `frontend/tests/components/ticket/EvaluationView.test.tsx` |

## ScoreBreakdown — `frontend/src/components/ticket/ScoreBreakdown.tsx`

| Field | Detail |
|---|---|
| Signature | `ScoreBreakdown(props: { scores: EvaluationScores }): JSX.Element` |
| Output | One row per entry of `RUBRIC_CATEGORIES`, in order: the label, its weight ("40%"), the score from `formatScore(scores[key])` out of 100, and a bar with an accessible name and value. Then a "Total" row from `formatScore(scores.total)`. |
| Rules | **The component performs no arithmetic on scores.** The total is `scores.total` as returned, even if it differs from a hand calculation. Values outside 0–100 are clamped only for the bar width, never for the number shown. Weights come only from `config/rubric.ts`. |
| Test file | `frontend/tests/components/ticket/ScoreBreakdown.test.tsx` |

## DiffViewer — `frontend/src/components/ticket/DiffViewer.tsx`

| Field | Detail |
|---|---|
| Signature | `DiffViewer(props: { diff: string }): JSX.Element` |
| Output | A scrollable region (`role="region"`, `aria-label="Diff"`, `tabIndex={0}`) with a `<pre>` holding one element per line. Lines starting with `+` (but not `+++`) are styled as added, lines starting with `-` (but not `---`) as removed, lines starting with `@@` as hunk headers, others as context. An empty diff shows "No changes in this diff." |
| Rules | Text nodes only. The leading `+` or `-` character stays in the text, so meaning is not color-only. No syntax highlighting (A-46). Lines are split on `\n` after removing a trailing `\r`. The region scrolls horizontally inside itself, and the page body never scrolls sideways. |
| Edge cases | A very large diff renders in full (Q-20). A line that contains HTML (rendered as text). Windows line endings. |
| Test file | `frontend/tests/components/ticket/DiffViewer.test.tsx` |

---

# 10.21 Profile Components

Files: `frontend/src/components/profile/*.tsx` (Doc 7).

## PracticeRecordNotice — `frontend/src/components/profile/PracticeRecordNotice.tsx`

| Field | Detail |
|---|---|
| Signature | `PracticeRecordNotice(): JSX.Element` and the exported constant `PRACTICE_RECORD_NOTICE_TEXT` |
| Purpose | The FR-51 label. |
| Output | The text "This is a practice work-sample record. It is not a certified or employer-verified credential." |
| Rules | Always rendered above the list, including in the loading, empty and error states of `ExperienceProfilePage`. The test asserts the exact text. It has no props and cannot be hidden. |
| Test file | `frontend/tests/components/profile/PracticeRecordNotice.test.tsx` |

## ExperienceItem — `frontend/src/components/profile/ExperienceItem.tsx`

| Field | Detail |
|---|---|
| Signature | `ExperienceItem(props: { item: ProfileItem }): JSX.Element` |
| Output | The title, category and difficulty badges (as given), the completion date (`formatDate`), the four category scores with their weights and the total (`ScoreBreakdown`), and the final feedback clamped to a few lines with a "Show full feedback" toggle (`aria-expanded`). A link "See feedback history and diff" to `/tickets/{ticketId}?tab=submissions`. |
| Rules | Score display is `ScoreBreakdown` only (no arithmetic). If `evaluation.scores` is `null` (a data problem the backend treats as an integrity failure), show "Score unavailable" instead of crashing. Feedback is plain text. There is no share button (FR-52). |
| Test file | `frontend/tests/components/profile/ExperienceItem.test.tsx` |

---

# 10.22 Pages

Files: `frontend/src/pages/**` (Doc 7). Pages are the frontend's equivalent of backend controllers: they stay thin. They call hooks, hold local UI state, and turn outcomes into navigation and messages. Layout and copy are defined in Doc 6 (PG-01 to PG-13) and are not repeated here. This section specifies the handlers.

Rules for every page:
- A page never calls `fetch`, never builds a query key by hand, and never reads a status code to pick copy where `mapApiError` already decides it.
- A page sets its title with `useDocumentTitle` and gives its `h1` `tabIndex={-1}`.
- A page never navigates after a failed mutation on its own. It shows the message, and a link where Doc 6 defines one.
- A page passes `isPending` from the mutation to `SubmitButton`, so double submission is impossible.
- Pages are wrapped by the route table (10.23), not by their own layout. `NotFoundPage` is the exception.

## PG-01 RegisterPage — `frontend/src/pages/auth/RegisterPage.tsx`

| Field | Detail |
|---|---|
| Signature | `RegisterPage(): JSX.Element`. Title "Create account". |
| Hooks | `useForm` with `registerSchema`, `useRegister`, `useResendVerification`. |
| Handlers | `onSubmit(values)`: `await register.mutateAsync(values)`; on success `setRegisteredEmail(values.email)` and focus the success heading. On failure: `const ui = applyServerErrorToForm(err, form, 'register')`, then if `ui.status === 409` call `form.setFocus('email')`. `handleResend()`: `resend.resend(registeredEmail)`. |
| Rules | Registering automatically establishes a session (EP-01 sets session cookies and `useRegister` seeds `queryKeys.me` per D-10). The success view informs the user that an account was created and a verification email was sent, and offers Resend. The unverified banner appears. The server's resend message is shown as returned. Fields are read-only while pending. |
| Edge cases | Email-send failure on the server (the account exists and EP-07 works, so the page cannot tell). 409 for an email that exists. Already logged in (handled by `PublicOnly`). |
| Test file | `frontend/tests/pages/auth/RegisterPage.test.tsx` |

## PG-02 LoginPage — `frontend/src/pages/auth/LoginPage.tsx`

| Field | Detail |
|---|---|
| Signature | `LoginPage(): JSX.Element`. Title "Log in". |
| Hooks | `useForm` with `loginSchema`, `useLogin`, router `location` and search params. |
| Handlers | `onSubmit(values)`: `await login.mutateAsync(values)`, then `navigate(getSafeRedirectPath(searchParams.get('from')), { replace: true })`. On failure: `const ui = applyServerErrorToForm(err, form)`; if `ui.status === 401`, call `form.resetField('password')` and `form.setFocus('password')`. |
| Rules | The notice banner reads `location.state?.notice`, and a constant `LOGIN_NOTICE_MESSAGES` in this file maps `session_expired` to "Your session expired. Log in again.", `password_reset` to "Password reset. Log in with your new password.", and `logged_out_all` to "You've been logged out of all devices." An unknown notice is ignored. There is no "remember me" (Doc 2 excludes it). |
| Edge cases | 429 from `authLimiter` (shown in `root`, the form stays usable). A `from` value that is unsafe (ignored). `PublicOnly` redirecting at the same instant as `navigate` (both go to the same safe path). |
| Test file | `frontend/tests/pages/auth/LoginPage.test.tsx` |

## PG-03 ForgotPasswordPage — `frontend/src/pages/auth/ForgotPasswordPage.tsx`

| Field | Detail |
|---|---|
| Signature | `ForgotPasswordPage(): JSX.Element`. Title "Reset your password". |
| Hooks | `useForm` with `forgotPasswordSchema`, `useForgotPassword`. |
| Handlers | `onSubmit(values)`: `const { message } = await forgot.mutateAsync(values)`, then `setSentMessage(message)`. On failure: `applyServerErrorToForm(err, form)`. `handleUseDifferentEmail()`: `setSentMessage(null)` and `form.reset()`. |
| Rules | The success view shows the server's message unchanged and adds no wording that hints whether the account exists. |
| Test file | `frontend/tests/pages/auth/ForgotPasswordPage.test.tsx` |

## PG-04 ResetPasswordPage — `frontend/src/pages/auth/ResetPasswordPage.tsx`

| Field | Detail |
|---|---|
| Signature | `ResetPasswordPage(): JSX.Element`. Title "Choose a new password". |
| Hooks | `useForm` with `resetPasswordSchema`, `useResetPassword`, search params. |
| Handlers | `token = searchParams.get('token')`. If empty, render the invalid-link view and never call the API. `onSubmit(values)`: `await reset.mutateAsync({ token, newPassword: values.newPassword })`, then `navigate('/login', { replace: true, state: { notice: 'password_reset' } })`. On failure: `const ui = mapApiError(err)`; if `ui.status === 410`, `setLinkProblem(ui.message)` and stop. Otherwise `const applied = applyServerErrorToForm(err, form, 'resetPassword')`; if `applied.status === 400` and `applied.message === SERVER_MESSAGES.invalidResetLink`, `setLinkProblem(applied.message)`. |
| Rules | The invalid-link view shows the message and a "Request a new link" link to `/forgot-password`. A used or expired link never changes anything (FR-08). The token stays in the URL so a refresh works (Doc 6, 6.5.9). |
| Test file | `frontend/tests/pages/auth/ResetPasswordPage.test.tsx` |

## PG-05 VerifyEmailPage — `frontend/src/pages/auth/VerifyEmailPage.tsx`

| Field | Detail |
|---|---|
| Signature | `VerifyEmailPage(): JSX.Element`. Title "Verify your email". |
| Hooks | `useVerifyEmail`, `useResendVerification`, `useMe`, `useForm` with `resendVerificationSchema`, search params. |
| Handlers | An effect runs once per page load: if `token` is empty, show the problem view (no request). Otherwise, guarded by `hasFired = useRef(false)` (a ref keeps its value across React StrictMode's simulated remount), set `hasFired.current = true` and call `verify.mutate({ token })`. The view comes from the mutation state: pending is "verifying", success is "success", error is "problem". The problem view shows `mapApiError(error).message` (the server text for 400 and 410) and the resend form. For a `network` or `timeout` error it shows `ErrorState` with a Retry that calls `verify.mutate` again. |
| Rules | The success button is "Go to dashboard" when `useMe` has a user, otherwise "Go to login". The resend email field is prefilled from `useMe` when logged in. 410 is strictly for expired unused tokens; already-used tokens for verified users return 200 soft success with `{ emailVerifiedAt }` (D-11). |
| Edge cases | Refresh or prefetch after success (200 soft success, preventing broken UI; dashboard link shown when logged in). Double effect in development (must not send two requests). Logged-out visitor (`useMe` returns 401, silently). |
| Test file | `frontend/tests/pages/auth/VerifyEmailPage.test.tsx` |

## PG-06 DashboardPage — `frontend/src/pages/dashboard/DashboardPage.tsx`

| Field | Detail |
|---|---|
| Signature | `DashboardPage(): JSX.Element`. Title "Dashboard". |
| Hooks | `useMe`, `useSetupProgress`, `useCurrentTicket`, `useAssignTicket`, `useQueryClient`. |
| Handlers | `handleGetTicket()`: clear `getError` and `getErrorLink`, then `const ticket = await assign.mutateAsync()` and `navigate('/tickets/' + ticket.id)`. On failure, `const ui = mapApiError(err)` and `setGetError(ui)`. For 402 set the link to `/billing` ("Go to billing"). For 403 set the link to `/github` ("Reconnect GitHub"). For 409, **do not read the message**: `await` a refetch of `queryKeys.currentTicket` and `queryKeys.githubConnection`, then read both from the cache. If a current ticket exists, `navigate` to it. Else if `repo` is `null`, set the link to `/github` ("Create your starter repository"). Otherwise just show the server message. |
| Rules | `getBlockedReason` for `CurrentTicketCard` is "Finish setup to get a ticket." while `progress.setupComplete` is `false`. Each card fails independently (Doc 6, PG-06). Errors from Get ticket stay inline (A-64). |
| Edge cases | Two tabs racing to get a ticket (the loser's 409 lands on the winner's ticket). Timeout on EP-23 (the hook refetches, and a ticket may now exist). Access lapsing after setup (step 1 reads "Subscribe again"). |
| Test file | `frontend/tests/pages/dashboard/DashboardPage.test.tsx` |

## PG-07 BillingPage — `frontend/src/pages/billing/BillingPage.tsx`

| Field | Detail |
|---|---|
| Signature | `BillingPage(): JSX.Element`. Title "Billing". |
| Hooks | `useSubscription`, `usePayments`, `useStartCheckout`, `useCancelSubscription`. |
| Handlers | `handleSubscribe()`: `setIsRedirecting(true)`, then `const { checkoutUrl } = await start.mutateAsync()` and `window.location.assign(checkoutUrl)`. On failure: `setIsRedirecting(false)` and `setSubscribeError(mapApiError(err))`. `isSubscribing` for the card is `start.isPending \|\| isRedirecting`. `handleConfirmCancel()`: `await cancel.mutateAsync()`, then close the dialog. On failure: status 409 closes the dialog (the hook already refetched); any other failure keeps it open and sets `cancelError` to `mapApiError(err).message`. Closing the dialog clears `cancelError`. |
| Rules | The redirect is a same-tab navigation. The button stays disabled until the page unloads (no double checkout). Nothing on this page marks the user subscribed. The cancel dialog text is Doc 6's PG-07 text. |
| Edge cases | Timeout on cancel (the hook refetches, and the card may already show "Canceled"). 409 on checkout because the user is already active in another tab. |
| Test file | `frontend/tests/pages/billing/BillingPage.test.tsx` |

## PG-08 CheckoutReturnPage — `frontend/src/pages/billing/CheckoutReturnPage.tsx`

| Field | Detail |
|---|---|
| Signature | `CheckoutReturnPage(): JSX.Element`. Title "Confirming payment". |
| Hooks | `useSubscription`. |
| Handlers | State: `timedOut: boolean`. `confirmed` is `data.subscription?.status === 'active' && data.hasAccess`. The page calls `useSubscription({ refetchIntervalMs: confirmed \|\| timedOut ? false : CHECKOUT_POLL_INTERVAL_MS })`. An effect, while neither `confirmed` nor `timedOut`, starts a timer for `CHECKOUT_POLL_MAX_MS` that sets `timedOut` to `true`, and clears it on cleanup. `handleCheckAgain()`: `setTimedOut(false)` and `refetch()` (the effect restarts the timer). |
| Rules | The four views are confirming, confirmed, timed out, and error (error only when the query failed and there is no data). Confirmed is shown only from EP-15 data. The page ignores every query parameter Chapa adds (A-37 of Doc 6). It never says "payment successful". The "Connect GitHub" button links to `/github`. |
| Edge cases | Reload mid-poll (restarts at zero). Intermittent poll failures while earlier data exists (keep "confirming"). A user who canceled at Chapa (ends in "timed out", whose text covers it). |
| Test file | `frontend/tests/pages/billing/CheckoutReturnPage.test.tsx` |

## PG-09 GitHubSetupPage — `frontend/src/pages/github/GitHubSetupPage.tsx`

| Field | Detail |
|---|---|
| Signature | `GitHubSetupPage(): JSX.Element`. Title "GitHub and repository". |
| Hooks | `useGitHubConnection`, `useSubscription`, `useGitHubConnect`, `useDisconnectGitHub`, `useCreateRepo`, search params. |
| Handlers | **On load:** `const result = parseGitHubOAuthResult(searchParams)`. If it is not `null`, keep it in state as `oauthResult` and remove only the `github` and `reason` parameters with `setSearchParams(next, { replace: true })`. **`handleConnect()`:** `const url = await connect.mutateAsync()` then `window.location.assign(url)`; keep `isConnecting` `true` until the page unloads; on failure set `connectError`. **`handleConfirmDisconnect()`:** `await disconnect.mutateAsync()` then close; a 404 closes the dialog as success; any other failure keeps it open with the message. **`handleCreateRepo(values)`:** `await createRepo.mutateAsync(values)`; on success an effect focuses the `RepoSummary` heading once `repo` appears; on failure `setRepoError(mapApiError(err))`. |
| Rules | `blocked` for `RepoCreateForm`: not connected gives "Connect GitHub to create your repository." with the link `#github-connection`; no access gives "An active subscription is required." with the link `/billing`. A token revoked mid-session (403) refetches the connection and shows the server message (FR-29). Nothing is stored about the OAuth attempt. |
| Edge cases | Refresh after params were stripped (no alert, as intended). GitHub callback landing with an unknown `reason` (generic text). Repo exists but GitHub is disconnected (Connect shown, `RepoSummary` still shown). |
| Test file | `frontend/tests/pages/github/GitHubSetupPage.test.tsx` |

## PG-10 TicketPage — `frontend/src/pages/tickets/TicketPage.tsx`

| Field | Detail |
|---|---|
| Signature | `TicketPage(): JSX.Element`. Title is the ticket title, or "Ticket" while loading. The route element is keyed by `ticketId` so state resets when the ID changes (for example after abandoning). |
| Hooks | `useParams`, `useTicket`, `useSubscription`, `useStartTicket`, `useAbandonTicket`, `useAssignTicket`, `useSubmitWork`, `useRetrySubmission` (created with `phase.retryAttempt` or `1`, and only called when it is non-null), `useQueryClient`, search params. |
| Derived state | `phase = getTicketPhase(ticket, submissions)`. `hasAccess = subscription.data ? subscription.data.hasAccess : true` (the server enforces access, so unknown means "do not pre-disable", A-75). `tab` is `?tab=` if it is one of `ticket`, `mentor`, `submissions`, else `phase.defaultTab`. `setTab(t)` uses `setSearchParams` with `replace`. |
| Handlers | **`handleAction(action)`:** `start` calls `start.mutateAsync()`; `submit` calls `submitWork.mutateAsync()` then `setTab('submissions')`; `resubmit` opens the confirm dialog; `retry` calls `retry.mutateAsync()`; `get_next` calls `assign.mutateAsync()` then `navigate('/tickets/' + ticket.id)`. A failure sets `actionError = mapApiError(err)`, which is cleared at the next action or phase change. **`handleConfirmResubmit()`:** `await submitWork.mutateAsync()`, close, `setTab('submissions')`; failure keeps the dialog open with the message, except 409, which closes it (the hook refetched). Dialog text is Doc 6's. **`handleConfirmAbandon()`:** `const r = await abandon.mutateAsync()`. If `r.newTicket`: toast "Ticket abandoned. Here's your new ticket." and `navigate('/tickets/' + r.newTicket.id, { replace: true })`. If `null`: toast "Ticket abandoned. We couldn't issue a new one right now. Try again from the dashboard." and `navigate('/dashboard')`. A 409 closes the dialog; other failures keep it open. **`handleSettled()`** (from `SubmissionsPanel`): `invalidateQueries(queryKeys.ticket(ticketId))`. **Final-review sync:** an effect runs when the latest submission is attempt 2 with status `completed` and `ticket.status` is still `resubmitted`; it refetches `queryKeys.ticket(ticketId)` up to `TICKET_DONE_SYNC_MAX_ATTEMPTS` times, `TICKET_DONE_SYNC_INTERVAL_MS` apart, and stops when the status reads `done`. A ref prevents two loops, and it is cancelled on unmount. When `ticket.status` becomes `done`, invalidate `queryKeys.currentTicket` and `queryKeys.profile` once. |
| Rules | Not found (a 404 or 400 from `useTicket`) shows the "Ticket not found" state with a link to the dashboard, identical for another user's ticket. Only `phase.primaryAction` produces a primary button. Abandon is shown only when `phase.canAbandon`, and disabled without access. The page passes `phase.mentor` to `MentorPanel` and never decides mentor rules itself. A 402 or 403 shows the Doc 6 banner or link and leaves the page readable. Nothing here can create a third submission: there is no control for it. |
| Edge cases | Same ticket open in two tabs (the loser's 409 refetches and the screen catches up). Timeout on submit (the hook refetches, and the phase moves on with no duplicate). Submission `completed` but the ticket still `resubmitted` (the sync loop). The user leaves and returns while a review is in flight (polling restarts). Abandon succeeds but issuing the new ticket fails. |
| Test file | `frontend/tests/pages/tickets/TicketPage.test.tsx` |

## PG-11 ExperienceProfilePage — `frontend/src/pages/profile/ExperienceProfilePage.tsx`

| Field | Detail |
|---|---|
| Signature | `ExperienceProfilePage(): JSX.Element`. Title "Experience profile". |
| Hooks | `useExperienceProfile`. |
| Handlers | None besides Retry (`refetch`). |
| Rules | `PracticeRecordNotice` renders in every state. The count line is "{n} completed ticket" or "{n} completed tickets". Empty state text and action are Doc 6's. Items render in the order returned. |
| Test file | `frontend/tests/pages/profile/ExperienceProfilePage.test.tsx` |

## PG-12 SettingsPage — `frontend/src/pages/settings/SettingsPage.tsx`

| Field | Detail |
|---|---|
| Signature | `SettingsPage(): JSX.Element`. Title "Settings". |
| Hooks | `useMe`, `useUpdateProfile`, `useChangePassword`, `useLogoutAll`, `useResendVerification`, `useUnsavedChangesWarning`, two `useForm` instances (`updateProfileSchema`, `changePasswordSchema`). |
| Handlers | **`onSaveProfile(values)`:** `const user = await updateProfile.mutateAsync(values)`, then `profileForm.reset({ name: user.name })` (this clears the dirty flag) and a toast "Profile updated". A failure goes to `root`. **`onCancelProfile()`:** `profileForm.reset({ name: me.name })`. **`onChangePassword(values)`:** `await changePassword.mutateAsync(values)`, then `passwordForm.reset()` and a toast "Password changed". On failure: `applyServerErrorToForm(err, passwordForm, 'changePassword')`; if the error landed on `currentPassword`, call `passwordForm.setFocus('currentPassword')`. **`onConfirmLogoutAll()`:** `await logoutAll.mutateAsync()` (the hook navigates); a failure keeps the dialog open with the message. **Unsaved changes:** `blocker = useUnsavedChangesWarning(profileForm.formState.isDirty \|\| passwordForm.formState.isDirty)`, and a `ConfirmDialog` bound to `blocker` reads "You have unsaved changes." with confirm "Leave" and cancel "Stay". |
| Rules | The profile form's default values come from `useMe` and are reset when the loaded name changes. Email is read-only. There is no account-deletion control (FR-14). |
| Edge cases | Session expiry mid-save (not blocked by the guard, unsaved values are lost, A-53 of Doc 6). Password change followed by a 401 elsewhere if the server revoked sessions (Q-11, handled by the session flow). |
| Test file | `frontend/tests/pages/settings/SettingsPage.test.tsx` |

## PG-13 NotFoundPage — `frontend/src/pages/NotFoundPage.tsx`

| Field | Detail |
|---|---|
| Signature | `NotFoundPage(): JSX.Element`. Title "Page not found". |
| Hooks | `useMe`. |
| Handlers | None. |
| Rules | While `useMe` is pending: `FullPageLoader`. With a user: the content inside `AppLayout` and a "Go to dashboard" button. Otherwise: inside `AuthLayout` and a "Go to login" button. It is registered on the `*` route outside the guards. |
| Test file | `frontend/tests/pages/NotFoundPage.test.tsx` |

---

# 10.23 App Wiring

These are behaviors in the template's existing App/router entry and `QueryClient` setup: `frontend/src/main.tsx` renders `frontend/src/App.tsx`; `frontend/src/routes/index.tsx` exports the React Router data-router object; and `frontend/src/lib/queryClient.ts` exports the singleton provided by `frontend/src/App.tsx`. They are specified as required behavior here, not as new parallel files (D-34).

## 10.23.1 Route table

```text
/                    RootRedirect
/register            PublicOnly > AuthLayout > RegisterPage
/login               PublicOnly > AuthLayout > LoginPage
/forgot-password     PublicOnly > AuthLayout > ForgotPasswordPage
/reset-password      AuthLayout > ResetPasswordPage
/verify-email        AuthLayout > VerifyEmailPage
/dashboard           RequireAuth > AppLayout > DashboardPage
/billing             RequireAuth > AppLayout > BillingPage
/billing/return      RequireAuth > AppLayout > CheckoutReturnPage
/github              RequireAuth > AppLayout > GitHubSetupPage
/tickets/:ticketId   RequireAuth > AppLayout > TicketPage   (keyed by ticketId)
/profile             RequireAuth > AppLayout > ExperienceProfilePage
/settings            RequireAuth > AppLayout > SettingsPage
*                    NotFoundPage
```

No `/admin`, no landing page, no other route exists in V1.

## 10.23.2 Query client defaults

| Setting | Value |
|---|---|
| `queries.retry` | `shouldRetryQuery` |
| `queries.refetchOnWindowFocus` | `true` (the TanStack default). `useMe` and the diff query override it |
| `mutations.retry` | `false` |
| Query cache `onError` | `(error) => handleGlobalApiError(error, queryClient)` |
| Mutation cache `onError` | `(error) => handleGlobalApiError(error, queryClient)` |

## 10.23.3 Session expiry wiring

`configureApiClient` is called once at startup with the API base URL and this `onSessionExpired` behavior:

1. Read whether `queryKeys.me` has cached data. If it does not, do nothing. This is a first load with no session, where `RequireAuth` redirects to the login page without a "session expired" notice (A-61).
2. Otherwise navigate with `replace` to `buildLoginRedirect(currentPathAndSearch)` with router state `{ notice: 'session_expired' }`.
3. Then call `queryClient.clear()`.

The callback runs outside React, so it uses the imperative `navigate` method on the data-router object exported by `frontend/src/routes/index.tsx`. A module-level navigate setter is unnecessary for this template (D-34).

## 10.23.4 Values other systems must match

| Value | Where it lives | Must equal |
|---|---|---|
| Verification link target | backend email template (EP-06) | `{FRONTEND_URL}/verify-email?token=…` |
| Reset link target | backend email template (EP-09) | `{FRONTEND_URL}/reset-password?token=…` |
| Chapa `return_url` | backend `CHAPA_RETURN_URL` | `{FRONTEND_URL}/billing/return` |
| GitHub callback landing | backend `handleGitHubCallback` redirect | `{FRONTEND_URL}/github?github=connected` or `?github=error&reason=…` |
| API base URL | one frontend environment variable (A-57) | the deployed API origin. `API_BASE_PATH` is `/api/v1` |

---

# 10.24 Hook-to-Endpoint Traceability

| Endpoint | Frontend function | Used by |
|---|---|---|
| EP-01 | `useRegister` | PG-01 |
| EP-02 | `useLogin` | PG-02 |
| EP-03 | `refreshSessionOnce` (inside `apiRequest`) | every protected call |
| EP-04 | `useLogout` | `AppLayout` |
| EP-05 | `useLogoutAll` | PG-12 |
| EP-06 | `useVerifyEmail` | PG-05 |
| EP-07 | `useResendVerification` | PG-01, PG-05, PG-12, `EmailVerificationBanner` |
| EP-08 | `useForgotPassword` | PG-03 |
| EP-09 | `useResetPassword` | PG-04 |
| EP-10 | `useChangePassword` | PG-12 |
| EP-11 | `useMe` | route wrappers, layouts, PG-05, PG-06, PG-12, PG-13 |
| EP-12 | `useUpdateProfile` | PG-12 |
| EP-13 | `useStartCheckout` | PG-07 |
| EP-14 | none (Chapa calls the backend) | — |
| EP-15 | `useSubscription` | PG-06, PG-07, PG-08, PG-09, PG-10, `SubscriptionBanner` |
| EP-16 | `useCancelSubscription` | PG-07 |
| EP-17 | `usePayments` | PG-07 |
| EP-18 | `useGitHubConnect` | PG-09 |
| EP-19 | none (browser redirect, lands on PG-09, read by `parseGitHubOAuthResult`) | PG-09 |
| EP-20 | `useGitHubConnection` | PG-06, PG-09, `useSetupProgress` |
| EP-21 | `useDisconnectGitHub` | PG-09 |
| EP-22 | `useCreateRepo` | PG-09 |
| EP-23 | `useAssignTicket` | PG-06, PG-10 |
| EP-24 | `useCurrentTicket` | PG-06, `AppLayout`, `useSetupProgress` |
| EP-25 | `useTicket` | PG-10 |
| EP-26 | `useStartTicket` | PG-10 |
| EP-27 | `useAbandonTicket` | PG-10 |
| EP-28 | `useSendMentorMessage` | `MentorPanel` |
| EP-29 | `useMentorMessages` | `MentorPanel` |
| EP-30 | `useSubmitWork` | PG-10 |
| EP-31 | `useSubmission` | `SubmissionCard` |
| EP-32 | `useRetrySubmission` | PG-10 |
| EP-33 | none (GitHub calls the backend) | — |
| EP-34 | `useExperienceProfile` | PG-11 |

---

# 10.25 Critical State Rules

These are invariants, not optional page behavior.

## 10.25.1 Ticket workspace

The allowed actions per phase are the table in 10.5 (`getTicketPhase`). In diagram form, showing what the UI offers:

```text
ready_to_start   -> Start working -> in_progress          (Abandon offered)
in_progress      -> Submit        -> first_review_processing   (Abandon offered)
first_review_processing -> feedback_ready | first_review_failed
first_review_failed     -> Retry review -> first_review_processing
feedback_ready   -> Resubmit (confirmed) -> final_review_processing
final_review_processing -> final_review_finalizing -> done | final_review_failed
final_review_failed     -> Retry review -> final_review_processing
done             -> Get next ticket
abandoned        -> (nothing)
```

The UI must never:
- offer Abandon once a submission exists;
- offer Submit or Resubmit outside `in_progress` and `feedback_ready`;
- show more than two submission cards, or any control that could create a third;
- show Retry on a submission that is not `failed`;
- show a score on attempt 1, or a "scored" phase;
- enable the mentor composer outside `in_progress` and `submitted_v1` (`feedback_ready`) (D-04);
- show `done` from anything except `ticket.status === 'done'` as returned by the API.

## 10.25.2 Submission polling

```text
idle (terminal or disabled)
processing --3 s--> processing --after 2 min--> slow (10 s, hint shown) --after 10 min--> stopped ("Check again")
processing | slow | stopped --status completed or failed--> terminal (no polling)
stopped --Check again--> processing (timers restart)
```

Polling never asks for the diff. A hidden tab pauses it.

## 10.25.3 Checkout confirmation

```text
confirming --EP-15 says active and hasAccess--> confirmed
confirming --60 s--> timed_out --Check again--> confirming
```

Only EP-15 data can reach `confirmed`.

## 10.25.4 Session

```text
booting --EP-11 ok--> authenticated
booting --EP-11 401 after refresh fails--> unauthenticated (RequireAuth redirects, no notice)
authenticated --any 401--> refreshing --ok--> authenticated (request replayed once)
refreshing --EP-03 401--> expired (clear cache, /login?from=..., notice)
refreshing --network or 5xx--> authenticated (error shown, no logout)
```

## 10.25.5 Mentor send

```text
idle --send--> sending --201--> idle
sending --429--> limit_reached (composer disabled)
sending --502, network, 409--> failed --Retry (only while in_progress or feedback_ready)--> sending
sending --timeout--> failed --transcript grew by 2--> idle (no duplicate)
```

## 10.25.6 Access

`hasAccess` is only ever the value EP-15 returned. The client never derives it from dates. The UI's disabling of actions is a convenience, and the server's 402 stays authoritative.

---

# 10.26 Concurrency and Stale-State Rules

1. **Double submit:** every mutation button is a `SubmitButton` bound to the mutation's pending state. Pages never re-enable it early.
2. **Checkout:** the Subscribe button stays disabled through the same-tab navigation, so two pending payments cannot be started by clicking twice.
3. **Simultaneous 401s:** exactly one EP-03 call; every failed request replays once; one redirect at most.
4. **StrictMode:** the email verification call is guarded by a ref, so the single-use token is not spent twice in development.
5. **Same ticket in two tabs:** any 409 on a ticket action refetches the ticket and shows the server message. The screen catches up instead of guessing.
6. **Mentor:** at most one send in flight. A timed-out send is reconciled against the refetched transcript before Retry is offered.
7. **Timeouts on mutations:** the hook refetches the affected queries (named in each hook). Retry controls are then derived from fresh data, so no separate gate exists.
8. **Polling restarts:** "Check again" and a changed `ticketId` or `attempt` reset the timers. Only one polling interval exists per query.
9. **Cache seeding:** a mutation's `onSuccess` writes or invalidates the keys listed in its hook. No page writes to the cache directly, except `TicketPage`'s refetch loop and its invalidations.
10. **Logout:** navigate first, then clear the cache, so the guard does not add a stale `from`.
11. **Stale dashboard:** window-focus refetch keeps `subscription`, `ticket` and `github-connection` fresh. A lapsed subscription is noticed on the next focus, or on the first 402.
12. **Old frontend, new API:** not handled in V1. An envelope that no longer matches becomes `unexpected_response`, and other shape changes are compile-time only (A-59).

---

# 10.27 Logging and Security Rules

Every frontend function must follow these unless a more specific rule above overrides them.

- Never write passwords, tokens, form values, API request bodies, or API response bodies to the console or to any tool.
- Never touch cookies, `localStorage`, `sessionStorage`, or IndexedDB. Never place a token anywhere in JavaScript.
- Never render API text with `dangerouslySetInnerHTML`. Mentor replies, feedback, `failureReason`, diffs, titles and scenarios are text.
- Links to external URLs go through `ExternalLink` (http and https only, `noopener noreferrer`). Redirects to API-supplied URLs require an absolute `https:` URL (A-67).
- `?from=` is validated by `getSafeRedirectPath` before every use.
- Token pages (PG-04, PG-05) load no external resources and contain no external links.
- Copied shell commands quote the branch name (`shellQuote`).
- Messages EP-07 and EP-08 return are shown verbatim. The UI adds no text that reveals account existence.
- Ownership failures (404) use one "not found" state.
- Hiding or disabling a control is never authorization. The backend enforces access with 401, 402, 403 and 404.
- No card or payment fields are rendered anywhere.
- No analytics, tracking, or third-party scripts exist in V1 (no requirement in docs 2, 5 or 6).
- Cookie `SameSite` and any CSRF header are open (Q-12). If a CSRF header is added, it goes only in `apiRequest`.

---

# 10.28 Configuration Boundaries

These live in configuration, not scattered through components:

- The API base URL (one environment variable, all of which are public; the frontend holds no secrets and no API keys).
- `API_BASE_PATH`.
- Every polling interval, poll limit, timeout, cooldown, copy-feedback and cache duration in `app.config.ts`.
- `MENTOR_MESSAGE_MAX_CHARS`, `null` until Q-10b is answered.
- The rubric labels and weights in `rubric.ts`.
- The GitHub permission wording in `GitHubConnectionCard` (one constant, Q-08).
- The notice-code to message map in `LoginPage` (one constant).

These do **not** exist yet and must not be created with made-up values: a subscription price (Q-14), a support contact (Q-18), a diff size limit (Q-20), a mentor length or message limit (Q-10).

---

# 10.29 Implementation Order

This follows Doc 7's phases 6 to 9, with the files from 10.2 placed first. Each step's tests are written with the step.

1. **Contracts and config:** `types/api.ts`, `config/app.config.ts`, `config/rubric.ts`, `lib/query-keys.ts`.
2. **Pure helpers and schemas:** `lib/ticket-phase.ts`, `lib/subscription-view.ts`, `lib/navigation.ts`, `lib/format.ts`, `lib/github.ts`, `schemas/auth.schemas.ts`, `schemas/github.schemas.ts`. These have no dependencies and the most rules.
3. **API foundation:** `lib/api/errors.ts`, then `lib/api/client.ts`. Then the `QueryClient` defaults and the session-expiry wiring (10.23.2, 10.23.3). Confirm the template's real HTTP client and router first (Q-19).
4. **Hooks:** `useMe`; the other auth hooks; billing; GitHub; tickets; mentor; submissions; profile; then `useSetupProgress`, `useUnsavedChangesWarning`, `useDocumentTitle`.
5. **Shared UI:** common components; layout components; route wrappers.
6. **Domain components**, leaves first. Billing (`PaymentHistory`, `SubscriptionCard`). GitHub (`RepoSummary`, `RepoCreateForm`, `GitHubConnectionCard`). Dashboard (`SetupChecklist`, `CurrentTicketCard`). Ticket (`DiffViewer`, `ScoreBreakdown`, `EvaluationView`, `SubmissionCard`, `SubmissionsPanel`, `MentorMessageList`, `MentorComposer`, `MentorPanel`, `BranchInstructions`, `TicketDetails`, `TicketHeader`, `TicketActionBar`). Profile (`PracticeRecordNotice`, `ExperienceItem`).
7. **Pages:** authentication pages, dashboard, billing pages, GitHub page, ticket page, profile, settings, not-found.
8. **Route table and integration wiring:** 10.23.1 and 10.23.4, including the values the backend must match.
9. **End-to-end and integration tests:** register, verify, login, subscribe (webhook simulated), connect GitHub, create repo, get ticket, mentor, submit, feedback, resubmit, final score, profile, logout. Then session expiry, and the 402, 403, 409, 429 and 502 paths, and the polling limits.

---

# 10.30 High-Scrutiny Completion Checklist

Before a frontend file is considered complete, the implementation AI or verifier must confirm:

- [ ] Signature and props match this document.
- [ ] Inputs are validated with the schema in 10.5 before the request, and the server error is still shown.
- [ ] Every query key comes from `queryKeys`, and every HTTP call goes through `apiRequest`.
- [ ] Mutations never retry automatically, and buttons are disabled while pending.
- [ ] Timeout and 409 paths refetch the affected queries.
- [ ] Errors go through `mapApiError` and show the doc 5 message where one exists.
- [ ] No token, password, form value or API body reaches the console, and nothing is stored in the browser.
- [ ] API text is rendered as text, and external links use `ExternalLink`.
- [ ] `hasAccess` comes only from EP-15.
- [ ] Nothing marks a subscription active except EP-15 data after the webhook.
- [ ] No card or payment fields exist.
- [ ] The attempt is never chosen by the client, and no third-submission control exists.
- [ ] Attempt 1 never shows a score, and no `scored` phase exists.
- [ ] Scores come from `scores.total` and the four category values, with no client arithmetic, and weights come only from `rubric.ts`.
- [ ] The mentor composer is enabled only in `in_progress` and `submitted_v1` (`feedback_ready`) (D-04), and never shows a hint level or attempt control.
- [ ] Abandon appears only in `assigned` and `in_progress`.
- [ ] Ownership 404s show the same "not found" state.
- [ ] The Voxide path, and all V2 and V3 UI, are absent (Django is supported in V1 per D-05).
- [ ] `PracticeRecordNotice` is on the profile page in every state.
- [ ] Focus and title update on route change, dialogs return focus, and status is never color-only.
- [ ] Doc 6 layout and copy are matched for every page.
- [ ] Tests cover success, validation, wrong state, each status in 10.4, timeouts, polling limits, and double-click.
- [ ] No file outside Doc 7 and 10.2 exists.

---

# 10.31 Assumptions

Numbering continues from Doc 6 (A-35 to A-54). Correct any that are wrong before implementation.

| ID | Assumption | Where it matters |
|---|---|---|
| A-55 | Section numbers reflect Doc 10 (10.x), resolving the previous collision where both backend and frontend function specs carried document number 8 (D-20). The backend spec is cited as Doc 8 / "backend 8.x". | whole doc |
| A-56 | The ten proposed files in 10.2 are needed to hold shared types, schemas, constants and pure helpers. They add no product behavior and need a Doc 7 amendment (10.33) | 10.2 |
| A-57 | The docs name no router, HTTP library, bundler or TanStack Query version. This spec uses generic names (`Navigate`, `replace`, search params) and a `fetch`-style contract. If the template wraps another client or router, keep it and satisfy the same contract. The API base URL comes from one environment variable, named per the template's convention | 10.4, 10.14, 10.23 |
| A-58 | The test stack is Vitest, React Testing Library and a request mocker (MSW), with tests under `frontend/tests/` mirroring `frontend/src/` (as the backend spec mirrors `tests/`). None of this is stated in docs 2 to 7 | every `Test file` row |
| A-59 | TypeScript types are compile-time only. At run time the client checks only the envelope shape. `ApiError.kind` has four values: `api`, `network`, `timeout`, `unexpected_response` | 10.3, 10.4 |
| A-60 | Only a 401 from EP-03 means the session is dead. A refresh that fails with a network error, timeout or 5xx surfaces as that error and does not log the user out | 10.4 |
| A-61 | `onSessionExpired` navigates only when a user was already cached in this tab. On a first load with no session it is silent, and `RequireAuth` redirects without the "session expired" notice | 10.23.3 |
| A-62 | An envelope response with a 5xx status other than 502 (Doc 5 lists none) is handled like 502: the server message and a Retry | `mapApiError` |
| A-63 | PG-04 adds a third exact-message match, "Invalid reset link", to Doc 6's A-41, so a 400 validation error and a 400 invalid link can be told apart | `applyServerErrorToForm`, PG-04 |
| A-64 | The dashboard checklist collapses whenever steps 1 to 3 are done, whether or not a ticket exists. The only "Get ticket" button lives in `CurrentTicketCard`. Errors from Get ticket show inline with a link and never navigate on their own. This clarifies Doc 6's PG-06, which had a Get-ticket button in both places and said 403 and 409 "go to" PG-09 | PG-06 |
| A-65 | `useMe` uses `staleTime` of 5 minutes (`ME_STALE_TIME_MS`), tunable | `useMe` |
| A-66 | `useResendVerification` owns the 60-second cooldown, per hook instance, started after a successful send only | 10.6 |
| A-67 | URLs the API returns for a browser redirect (`checkoutUrl`, `authorizeUrl`) must be absolute `https:` URLs. Otherwise the call fails as `unexpected_response` | `useStartCheckout`, `useGitHubConnect` |
| A-68 | API-supplied link URLs (`prUrl`, `ciRunUrl`) are untrusted. `ExternalLink` renders only `http:` and `https:` URLs as links | `ExternalLink` |
| A-69 | The dashboard card uses a coarse label from `ticket.status` (EP-24 has no submissions). `TicketPage` uses the detailed phase | `CurrentTicketCard` |
| A-70 | `final_review_finalizing` names the moment when attempt 2 is `completed` but the ticket still reads `resubmitted`. Doc 6's PG-10 state list already describes it | `getTicketPhase` |
| A-71 | After a mentor send times out, the panel compares the refetched transcript to the length recorded before the send. If it grew by 2, the message went through and no Retry is offered. This prevents a duplicate | `MentorPanel` |
| A-72 | Scores show as a whole number, or one decimal when not whole. Dates show as "19 Sep 2026" (with 24-hour time where a time is needed). Amounts show as the API string plus the currency code | 10.5 |
| A-73 | `useSubmission` returns `{ query, showSlowHint, pollingStopped, restartPolling }` and owns the polling policy. Doc 6 only said it polls | `useSubmission` |
| A-74 | UI copy that docs 2, 5 and 6 do not give is chosen here (validation messages, banner and step text, "Get a ticket"). It can change without changing any function signature | schemas, banners, `useSetupProgress` |
| A-75 | On `TicketPage`, `hasAccess` is treated as `true` while the subscription query is loading or has failed, so buttons do not flash disabled. The server still enforces access | PG-10 |
| A-76 | `useLogout` and `useLogoutAll` navigate first and clear the cache second, and they are the only hooks that navigate | 10.6 |
| A-77 | PG-05 calls `useMe` to choose between "Go to dashboard" and "Go to login". For a logged-out visitor this costs one silent 401 | PG-05 |
| A-78 | The next document in the series is Doc 11 (`work-simulator-test-plan-frontend.md`), covering the frontend test plan and test files | footer |

---

# 10.32 Open Questions

Numbering continues from Doc 6 (Q-14 to Q-18). Q-03 to Q-18 from earlier docs are still open unless noted, and the ones that touch this document are listed in section 10.1's rules.

| ID | Question | Affects |
|---|---|---|
| Q-19 | **Which router, HTTP client, bundler and TanStack Query version does the real frontend template use, and how is its `QueryClient` and test setup organized?** The docs name none of them (A-57, A-58). This can be answered by reading the template, and must be done before step 3 of 10.29 | 10.4, 10.14, 10.23, every test path |
| Q-20 | **Is there a maximum diff size the UI should handle?** EP-31 returns the full diff, and Doc 5 sets no limit. `DiffViewer` renders every line. Should it cap, collapse, or paginate very large diffs? Interim: render in full, only when the user opens it | `DiffViewer`, `SubmissionCard` |

---

# 10.33 Changes to Earlier Docs

Numbering is not changed. These are amendments.

**Doc 7:**
- **7.3.** Add the ten files listed in 10.2: `frontend/src/types/api.ts`, `config/app.config.ts`, `lib/query-keys.ts`, `lib/ticket-phase.ts`, `lib/subscription-view.ts`, `lib/navigation.ts`, `lib/format.ts`, `lib/github.ts`, `schemas/auth.schemas.ts`, `schemas/github.schemas.ts`. Doc 7's PR checklist ("no new file silently introduces a requirement") would otherwise reject them. Doc 6, A-42 already required the timing constants "in one config file", and 7.3.11 lists only `rubric.ts`. (Note: D-27 integrated these into Doc 7).
- **7.9.** In Phase 6, create these files (and the tests for the pure helpers) before the hooks.

**Doc 6:**
- **PG-06 (A-64).** The checklist collapses whenever steps 1 to 3 are done. The only "Get ticket" button is in `CurrentTicketCard`. Get-ticket errors show inline with links instead of navigating.
- **A-41 (A-63).** A third exact-message match is added: "Invalid reset link" on PG-04.
- **6.4 hooks (A-66, A-73, A-76).** `useResendVerification` returns a state object with the cooldown. `useSubmission` returns `{ query, showSlowHint, pollingStopped, restartPolling }`. `useLogout` and `useLogoutAll` navigate.
- **PG-10 (A-70).** The phase `final_review_finalizing` is named. Its behavior was already in Doc 6's state list.

**Doc 5:** No change.

**Backend function spec:** Note that backend file naming discrepancies against Doc 7 (e.g., `ticket-generator.service.ts`, `evaluator.service.ts`, etc.) were reconciled per D-16.

No locked decision is changed.

---

*This frontend document is intentionally implementation-specific without inventing unresolved product decisions. Where Docs 2, 5 or 6 leave a behavior open, the implementation must isolate it in one constant or one branch and leave the decision visible rather than silently choosing one.*

*Numbering convention: FR-01, FR-02... (doc 2), `UC-##` (doc 3), `DR-##`, `A-##` and `Q-##` (docs 4, 5, 6 and this doc), `EP-##` (doc 5) and `PG-##` (doc 6) each form one continuous sequence across the whole series. Never renumber once used.*

Next: proceed to → [11. Test Plan & Test Files — Frontend](./work-simulator-test-plan-frontend.md)
