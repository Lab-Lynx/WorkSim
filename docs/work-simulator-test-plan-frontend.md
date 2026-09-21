# 9. Test Plan & Test Files — Frontend

*Project: Work Simulator · Maps directly to `8. Function-Level Specification — Frontend`.*

**Scope:** frontend unit, hook, component, page, routing, API-client, and cross-feature integration/system tests. The backend test plan remains the source for backend behavior; this document tests the frontend contract against the frontend function-level specification.

## 9.0 Test-First Rules

- The frontend test file mirrors the source path under `frontend/tests/`, never co-located.
- Every function/component/page that has a `Test file` in frontend function-level spec 8 must have that test written before implementation.
- Tests are derived from the specified signature, rules, edge cases, and source-of-truth constraints. They must not invent unresolved product decisions.
- Open questions remain configurable or are tested only for the behavior explicitly specified around them: Q-04, Q-08, Q-10, Q-11, Q-12, Q-13, Q-14, Q-15, Q-16, Q-17, Q-18, Q-20.
- HTTP is mocked at the API-client boundary for hook/component/page tests. The API client itself uses mocked `fetch`.
- Chapa, GitHub, Gemini/Groq-backed mentor/evaluation behavior is never contacted by frontend automated tests.
- Use fake timers for polling, cooldowns, timeouts, and delayed UI states. Never make tests wait in real time.
- Every mutation has retry disabled. Query retry is tested only through `shouldRetryQuery`.
- Authentication cookies are never read or manually supplied by frontend code under test. Assertions should verify `credentials: 'include'` and absence of token persistence.
- Server messages are authoritative and must be shown where the specification says they are shown.
- API text is rendered as text, never as HTML. Tests must include malicious-looking HTML where the specification explicitly requires text rendering.
- Ownership failures must produce the same not-found state; tests must not expose another user's resource.
- Tests should prefer accessible roles/names and user-visible behavior over implementation details.
- Component tests mock hooks at their boundary only where necessary; hook tests exercise the hook behavior independently.
- Query-cache assertions must use the single `queryKeys` factory rather than hand-written cache keys.

## 9.1 Test File Map

One row per source file/function group specified by frontend function-level spec 8.

| Source file | Test file | Test type | Written before code? |
|---|---|---|---|

| `frontend/src/lib/api/client.ts` | `frontend/tests/lib/api/client.test.ts` | Unit (mocked fetch) | ☐ |
| `frontend/src/lib/api/errors.ts` | `frontend/tests/lib/api/errors.test.ts` | Unit (mocked fetch) | ☐ |
| `frontend/src/lib/ticket-phase.ts` | `frontend/tests/lib/ticket-phase.test.ts` | Unit | ☐ |
| `frontend/src/lib/subscription-view.ts` | `frontend/tests/lib/subscription-view.test.ts` | Unit | ☐ |
| `frontend/src/lib/navigation.ts` | `frontend/tests/lib/navigation.test.ts` | Unit | ☐ |
| `frontend/src/lib/format.ts` | `frontend/tests/lib/format.test.ts` | Unit | ☐ |
| `frontend/src/lib/github.ts` | `frontend/tests/lib/github.test.ts` | Unit | ☐ |
| `frontend/src/hooks/auth/useMe.ts` | `frontend/tests/hooks/auth/useMe.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/auth/useLogin.ts` | `frontend/tests/hooks/auth/useLogin.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/auth/useLogout.ts` | `frontend/tests/hooks/auth/useLogout.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/auth/useVerifyEmail.ts` | `frontend/tests/hooks/auth/useVerifyEmail.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/auth/useResendVerification.ts` | `frontend/tests/hooks/auth/useResendVerification.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/billing/useSubscription.ts` | `frontend/tests/hooks/billing/useSubscription.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/billing/useStartCheckout.ts` | `frontend/tests/hooks/billing/useStartCheckout.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/billing/useCancelSubscription.ts` | `frontend/tests/hooks/billing/useCancelSubscription.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/billing/usePayments.ts` | `frontend/tests/hooks/billing/usePayments.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/github/useGitHubConnection.ts` | `frontend/tests/hooks/github/useGitHubConnection.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/github/useGitHubConnect.ts` | `frontend/tests/hooks/github/useGitHubConnect.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/github/useDisconnectGitHub.ts` | `frontend/tests/hooks/github/useDisconnectGitHub.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/github/useCreateRepo.ts` | `frontend/tests/hooks/github/useCreateRepo.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/tickets/useCurrentTicket.ts` | `frontend/tests/hooks/tickets/useCurrentTicket.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/tickets/useTicket.ts` | `frontend/tests/hooks/tickets/useTicket.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/tickets/useAssignTicket.ts` | `frontend/tests/hooks/tickets/useAssignTicket.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/tickets/useStartTicket.ts` | `frontend/tests/hooks/tickets/useStartTicket.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/tickets/useAbandonTicket.ts` | `frontend/tests/hooks/tickets/useAbandonTicket.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/mentor/useMentorMessages.ts` | `frontend/tests/hooks/mentor/useMentorMessages.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/mentor/useSendMentorMessage.ts` | `frontend/tests/hooks/mentor/useSendMentorMessage.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/submissions/useSubmission.ts` | `frontend/tests/hooks/submissions/useSubmission.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/submissions/useSubmitWork.ts` | `frontend/tests/hooks/submissions/useSubmitWork.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/submissions/useRetrySubmission.ts` | `frontend/tests/hooks/submissions/useRetrySubmission.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/profile/useExperienceProfile.ts` | `frontend/tests/hooks/profile/useExperienceProfile.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/useSetupProgress.ts` | `frontend/tests/hooks/useSetupProgress.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/useUnsavedChangesWarning.ts` | `frontend/tests/hooks/useUnsavedChangesWarning.test.tsx` | Hook | ☐ |
| `frontend/src/hooks/useDocumentTitle.ts` | `frontend/tests/hooks/useDocumentTitle.test.tsx` | Hook | ☐ |
| `frontend/src/routes/RequireAuth.tsx` | `frontend/tests/routes/RequireAuth.test.tsx` | Routing/component | ☐ |
| `frontend/src/routes/PublicOnly.tsx` | `frontend/tests/routes/PublicOnly.test.tsx` | Routing/component | ☐ |
| `frontend/src/routes/RootRedirect.tsx` | `frontend/tests/routes/RootRedirect.test.tsx` | Routing/component | ☐ |
| `frontend/src/components/layout/AuthLayout.tsx` | `frontend/tests/components/layout/AuthLayout.test.tsx` | Component | ☐ |
| `frontend/src/components/layout/AppLayout.tsx` | `frontend/tests/components/layout/AppLayout.test.tsx` | Component | ☐ |
| `frontend/src/components/layout/FullPageLoader.tsx` | `frontend/tests/components/layout/FullPageLoader.test.tsx` | Component | ☐ |
| `frontend/src/components/layout/EmailVerificationBanner.tsx` | `frontend/tests/components/layout/EmailVerificationBanner.test.tsx` | Component | ☐ |
| `frontend/src/components/layout/SubscriptionBanner.tsx` | `frontend/tests/components/layout/SubscriptionBanner.test.tsx` | Component | ☐ |
| `frontend/src/components/common/PasswordInput.tsx` | `frontend/tests/components/common/PasswordInput.test.tsx` | Component | ☐ |
| `frontend/src/components/common/FormRootError.tsx` | `frontend/tests/components/common/FormRootError.test.tsx` | Component | ☐ |
| `frontend/src/components/common/SubmitButton.tsx` | `frontend/tests/components/common/SubmitButton.test.tsx` | Component | ☐ |
| `frontend/src/components/common/ErrorState.tsx` | `frontend/tests/components/common/ErrorState.test.tsx` | Component | ☐ |
| `frontend/src/components/common/EmptyState.tsx` | `frontend/tests/components/common/EmptyState.test.tsx` | Component | ☐ |
| `frontend/src/components/common/StatusBadge.tsx` | `frontend/tests/components/common/StatusBadge.test.tsx` | Component | ☐ |
| `frontend/src/components/common/ConfirmDialog.tsx` | `frontend/tests/components/common/ConfirmDialog.test.tsx` | Component | ☐ |
| `frontend/src/components/common/ExternalLink.tsx` | `frontend/tests/components/common/ExternalLink.test.tsx` | Component | ☐ |
| `frontend/src/components/common/CopyButton.tsx` | `frontend/tests/components/common/CopyButton.test.tsx` | Component | ☐ |
| `frontend/src/components/billing/SubscriptionCard.tsx` | `frontend/tests/components/billing/SubscriptionCard.test.tsx` | Component | ☐ |
| `frontend/src/components/billing/PaymentHistory.tsx` | `frontend/tests/components/billing/PaymentHistory.test.tsx` | Component | ☐ |
| `frontend/src/components/github/GitHubConnectionCard.tsx` | `frontend/tests/components/github/GitHubConnectionCard.test.tsx` | Component | ☐ |
| `frontend/src/components/github/RepoCreateForm.tsx` | `frontend/tests/components/github/RepoCreateForm.test.tsx` | Component | ☐ |
| `frontend/src/components/github/RepoSummary.tsx` | `frontend/tests/components/github/RepoSummary.test.tsx` | Component | ☐ |
| `frontend/src/components/dashboard/SetupChecklist.tsx` | `frontend/tests/components/dashboard/SetupChecklist.test.tsx` | Component | ☐ |
| `frontend/src/components/dashboard/CurrentTicketCard.tsx` | `frontend/tests/components/dashboard/CurrentTicketCard.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/TicketHeader.tsx` | `frontend/tests/components/ticket/TicketHeader.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/TicketActionBar.tsx` | `frontend/tests/components/ticket/TicketActionBar.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/TicketDetails.tsx` | `frontend/tests/components/ticket/TicketDetails.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/BranchInstructions.tsx` | `frontend/tests/components/ticket/BranchInstructions.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/MentorPanel.tsx` | `frontend/tests/components/ticket/MentorPanel.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/MentorMessageList.tsx` | `frontend/tests/components/ticket/MentorMessageList.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/MentorComposer.tsx` | `frontend/tests/components/ticket/MentorComposer.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/SubmissionsPanel.tsx` | `frontend/tests/components/ticket/SubmissionsPanel.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/SubmissionCard.tsx` | `frontend/tests/components/ticket/SubmissionCard.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/EvaluationView.tsx` | `frontend/tests/components/ticket/EvaluationView.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/ScoreBreakdown.tsx` | `frontend/tests/components/ticket/ScoreBreakdown.test.tsx` | Component | ☐ |
| `frontend/src/components/ticket/DiffViewer.tsx` | `frontend/tests/components/ticket/DiffViewer.test.tsx` | Component | ☐ |
| `frontend/src/components/profile/PracticeRecordNotice.tsx` | `frontend/tests/components/profile/PracticeRecordNotice.test.tsx` | Component | ☐ |
| `frontend/src/components/profile/ExperienceItem.tsx` | `frontend/tests/components/profile/ExperienceItem.test.tsx` | Component | ☐ |
| `frontend/src/pages/auth/RegisterPage.tsx` | `frontend/tests/pages/auth/RegisterPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/auth/LoginPage.tsx` | `frontend/tests/pages/auth/LoginPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | `frontend/tests/pages/auth/ForgotPasswordPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | `frontend/tests/pages/auth/ResetPasswordPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/auth/VerifyEmailPage.tsx` | `frontend/tests/pages/auth/VerifyEmailPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/dashboard/DashboardPage.tsx` | `frontend/tests/pages/dashboard/DashboardPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/billing/BillingPage.tsx` | `frontend/tests/pages/billing/BillingPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/billing/CheckoutReturnPage.tsx` | `frontend/tests/pages/billing/CheckoutReturnPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/github/GitHubSetupPage.tsx` | `frontend/tests/pages/github/GitHubSetupPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/tickets/TicketPage.tsx` | `frontend/tests/pages/tickets/TicketPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/profile/ExperienceProfilePage.tsx` | `frontend/tests/pages/profile/ExperienceProfilePage.test.tsx` | Page | ☐ |
| `frontend/src/pages/settings/SettingsPage.tsx` | `frontend/tests/pages/settings/SettingsPage.test.tsx` | Page | ☐ |
| `frontend/src/pages/NotFoundPage.tsx` | `frontend/tests/pages/NotFoundPage.test.tsx` | Page | ☐ |

### 9.1.1 Proposed cross-feature integration/system test files

These tests do not mirror one source file because they verify behavior across the API client, hooks, router, cache and page/component boundaries.

| Area | Test file | Test type | Written before code? |
|---|---|---|---|
| Auth flow | `frontend/tests/integration/auth-flow.integration.test.tsx` | Integration | ☐ |
| Billing/checkout | `frontend/tests/integration/billing-flow.integration.test.tsx` | Integration | ☐ |
| GitHub setup | `frontend/tests/integration/github-flow.integration.test.tsx` | Integration | ☐ |
| Ticket lifecycle | `frontend/tests/integration/ticket-lifecycle.integration.test.tsx` | Integration | ☐ |
| Mentor flow | `frontend/tests/integration/mentor-flow.integration.test.tsx` | Integration | ☐ |
| Submission/evaluation | `frontend/tests/integration/submission-flow.integration.test.tsx` | Integration | ☐ |
| Session expiry | `frontend/tests/integration/session-expiry.integration.test.tsx` | Integration | ☐ |
| Route access/gates | `frontend/tests/integration/route-gates.integration.test.tsx` | Integration | ☐ |
| Accessibility/security rendering | `frontend/tests/integration/security-accessibility.integration.test.tsx` | Integration | ☐ |

## 9.2.1 `lib/api/client.ts` — API foundation

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **apiRequest — successful envelope** | mock fetch 200 with `{ statusCode, success: true, message, data }` | call `apiRequest` | returns `{ data, message, statusCode }`, performs one request, uses the configured base URL and `credentials: 'include'` |
| **apiRequest — body/content type** | request has a JSON body | call `apiRequest` | sends `Content-Type: application/json`; no body means no JSON content-type requirement |
| **apiRequest — query serialization** | query contains string, number, boolean and undefined values | call `apiRequest` | serializes defined values and omits undefined values |
| **apiRequest — API failure** | mock non-2xx or `success: false` envelope | call `apiRequest` | throws `ApiError` with `kind: 'api'`, the envelope status and server message |
| **apiRequest — malformed JSON** | mock HTML or invalid JSON response | call `apiRequest` | throws `ApiError` with `kind: 'unexpected_response'` |
| **apiRequest — empty 2xx body** | mock 2xx with empty body | call `apiRequest` | throws `unexpected_response` |
| **apiRequest — network failure** | mock fetch rejection | call `apiRequest` | throws `kind: 'network'` with the generic network behavior handled later by `mapApiError` |
| **apiRequest — timeout** | fake timer; fetch remains pending | advance past selected timeout | throws `kind: 'timeout'`; late response is ignored |
| **apiRequest — caller abort** | provide an `AbortSignal` that aborts | abort request | rethrows the caller abort unchanged; does not convert it to `ApiError` and does not retry |
| **apiRequest — default timeout** | ordinary endpoint | inspect fetch/abort timing | uses `REQUEST_TIMEOUT_DEFAULT_MS` unless an explicit timeout is supplied |
| **apiRequest — long timeout paths** | call each of EP-22, EP-23, EP-27, EP-28, EP-30 | inspect selected timeout | uses `REQUEST_TIMEOUT_LONG_MS` |
| **apiRequest — explicit timeout override** | ordinary and long-timeout endpoint | pass `timeoutMs` | explicit timeout wins over path defaults |
| **apiRequest — 401 refresh/replay** | protected request returns 401; refresh succeeds | call `apiRequest` | calls refresh once, replays the original request once with refresh disabled, and returns the replay result |
| **apiRequest — login 401 is not refreshed** | EP-02 `/auth/login` returns 401 | call `apiRequest` | does not call refresh; original 401 reaches caller |
| **apiRequest — refresh 401** | protected request 401; refresh returns 401 | call `apiRequest` | does not replay; calls `onSessionExpired` once and throws the original 401 |
| **apiRequest — replay 401** | refresh succeeds; replay returns 401 | call `apiRequest` | calls `onSessionExpired` once and throws the original/replay 401 according to the specified guard behavior |
| **apiRequest — refresh network/timeout/5xx** | refresh fails without 401 | call `apiRequest` | throws refresh error, does not log the user out, and does not retry again |
| **apiRequest — concurrent 401s** | several requests fail with 401 at the same time | resolve the shared refresh | all callers await one `refreshSessionOnce`, then each replays once |
| **apiRequest — no token persistence** | spy on browser storage APIs | run authenticated request | never reads/writes localStorage, sessionStorage or IndexedDB |
| **apiRequest — no secret/body logging** | use sentinel request/response/header/error values | force success and failure paths | no request body, response body, headers or error payload are logged |

## 9.2.2 `lib/api/errors.ts` — error mapping and retry

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **mapApiError — network/timeout/unexpected response** | create each error kind | call mapper | returns generic message, `retry`, `isNotFound: false`; timeout also sets `isTimeout` |
| **mapApiError — 400/401** | ApiError status 400 and 401 | call mapper | action is `none`, not found false |
| **mapApiError — 402** | ApiError 402 | call mapper | action is `go_billing` |
| **mapApiError — 403** | ApiError 403 | call mapper | action is `reconnect_github` |
| **mapApiError — 404** | ApiError 404 | call mapper | action `none`, `isNotFound: true` |
| **mapApiError — 409/410/429** | create each status | call mapper | 409=`refetch`, 410=`request_new_link`, 429=`none` |
| **mapApiError — 5xx** | 502 and another 5xx with server message | call mapper | action `retry`; server message is preserved for API errors |
| **mapApiError — unknown error** | throw a non-ApiError | call mapper | network-style generic retry UiError |
| **applyServerErrorToForm — default** | mock form.setError | map generic/server error | sets `root` with server message and returns UiError |
| **applyServerErrorToForm — register duplicate** | 409 in register context | map error | sets `email` instead of root |
| **applyServerErrorToForm — wrong current password** | 400 plus exact `Current password is incorrect` in change-password context | map error | sets `currentPassword` |
| **applyServerErrorToForm — invalid reset link** | 400 plus exact `Invalid reset link` in reset context | map error | does not set a form field; returns UiError for invalid-link view |
| **applyServerErrorToForm — changed server message** | 400 with a different message | map error | falls back safely to root |
| **handleGlobalApiError — billing** | 402 error and query client spy | call handler | invalidates `queryKeys.subscription` only |
| **handleGlobalApiError — GitHub** | 403 error | call handler | invalidates `queryKeys.githubConnection` only |
| **handleGlobalApiError — other errors** | 400/404/500/network errors | call handler | does not navigate or show UI |
| **shouldRetryQuery — retryable** | network, timeout, 500+ with failureCount 0 | call function | returns true |
| **shouldRetryQuery — one retry exhausted** | retryable error with failureCount 1 | call function | returns false |
| **shouldRetryQuery — 4xx** | 400,401,402,403,404,409,410,429 | call function | returns false |
| **shouldRetryQuery — abort** | aborted request error | call function | returns false |

## 9.2.3 Pure helpers, config, query keys and schemas

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **rubric weights — exact contract** | load `RUBRIC_CATEGORIES` | inspect entries | exactly four entries in required order with weights 40/25/20/15 |
| **rubric weights — sum** | load categories | sum `weightPercent` | equals 100; test proves the UI config is not doing score arithmetic |
| **query keys — constants** | load `queryKeys` | inspect values | matches exactly the specified tuples |
| **query keys — parameterized** | call ticket/mentor/submission factories with sample IDs and both includeDiff values | inspect output | returns exact tuple shape and preserves `attempt`/`includeDiff` |
| **query keys — no broad ticket invalidation** | exercise code using ticket cache helpers | inspect invalidation key | no bare `['ticket']` invalidation is used |
| **getTicketPhase — ready** | assigned ticket with no submission | call helper | returns `ready_to_start`, start action, mentor not-started, abandon true, ticket tab default |
| **getTicketPhase — in progress** | in-progress ticket with no submission | call helper | returns in-progress phase with submit action and mentor enabled |
| **getTicketPhase — first review processing** | submitted_v1 + awaiting/evaluating attempt 1 | call helper | returns first-review processing and `isProcessing: true` |
| **getTicketPhase — first feedback ready** | submitted_v1 + completed attempt 1 with evaluation | call helper | returns feedback-ready and resubmit action |
| **getTicketPhase — first review failed** | submitted_v1 + failed attempt 1 | call helper | returns first-review-failed and retry attempt 1 |
| **getTicketPhase — final review processing** | resubmitted + awaiting/evaluating attempt 2 | call helper | returns final-review-processing |
| **getTicketPhase — final review failed** | resubmitted + failed attempt 2 | call helper | returns final-review-failed and retry attempt 2 |
| **getTicketPhase — finalizing** | resubmitted + completed attempt 2 while ticket is not yet done | call helper | returns `final_review_finalizing` |
| **getTicketPhase — done/abandoned** | done or abandoned ticket | call helper | returns terminal phase, no primary action; mentor is read-only |
| **getTicketPhase — missing expected submission** | submitted_v1/resubmitted with no matching submission | call helper | returns processing phase and never throws |
| **getTicketPhase — submissions unordered** | two submissions in reverse order | call helper | highest attempt is treated as latest |
| **getTicketPhase — unknown status** | runtime ticket status outside declared union | call helper | safe in-progress defaults: no primary action, no abandon, mentor read-only |
| **getTicketStatusLabel — every status** | each declared TicketStatus | call helper | returns the exact configured label |
| **getSubscriptionView — all documented states** | construct never/active/renewal_pending/past_due_access/past_due_ended/canceled_access/ended/unknown inputs | call helper | returns the corresponding view kind and display data without inventing price or past-due action |
| **getSafeRedirectPath — safe relative path** | safe `from` | call helper | returns the safe path |
| **getSafeRedirectPath — unsafe/absolute/external** | external URL, protocol-relative URL, malformed value | call helper | falls back to supplied default |
| **buildLoginRedirect** | path with query string | call helper | produces login redirect preserving safe `from` only |
| **formatDate/formatDateTime** | valid ISO dates and invalid/missing values as applicable | call formatter | matches specified display contract and does not throw |
| **formatAmount** | amount/currency samples | call formatter | formats according to the frontend contract |
| **formatScore** | normal, boundary, decimal and out-of-range scores | call formatter | formats display value; does not perform rubric arithmetic |
| **buildRepoUrl/buildBranchUrl** | repo and branch names including slash/space/quote | call helper | builds expected GitHub links safely |
| **parseGitHubOAuthResult — success** | success callback params | parse | returns success result without exposing unknown data |
| **parseGitHubOAuthResult — known failures** | state_invalid/scope_invalid/exchange_failed | parse | returns typed result |
| **parseGitHubOAuthResult — unknown reason** | unknown callback reason | parse | returns generic/unknown typed result; never echoes raw reason |
| **shell/URL helper safety** | malformed values | call helper | does not generate an external destination outside the specified GitHub/link rules |
| **auth schemas — valid inputs** | valid register/login/forgot/reset/change-password/profile/resend values | parse | accepts values required by the frontend spec |
| **auth schemas — invalid inputs** | empty/invalid email, password below required constraints, mismatched reset passwords where specified | parse | rejects with field-level validation errors |
| **GitHub repo schema — valid templates** | react and node_express with valid names | parse | accepts supported templates |
| **GitHub repo schema — unsupported/invalid name** | django or invalid repo name | parse | rejects; client never sends unsupported template |

## 9.2.4 Auth hooks

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useMe — success** | mock EP-01 success | render hook | returns user data and caches it under `queryKeys.me` |
| **useMe — 401** | mock 401 | render hook | exposes error for route handling; does not manually inspect cookies |
| **useMe — network/5xx** | mock retryable error | render hook | uses query retry policy, not mutation retry |
| **useLogin — success** | mock EP-02 success | mutate valid credentials | seeds/invalidate behavior specified for `me`, resets session-expired guard, returns success |
| **useLogin — failure** | mock server error | mutate | exposes error without client-side token storage |
| **useLogout — success** | mock EP-04 success | mutate | clears relevant auth/cache state and navigates as specified |
| **useLogout — non-401 failure** | mock failure | mutate | does not falsely claim logout; caller can show retry/toast behavior |
| **useVerifyEmail — success/410** | mock EP-06 success and expired/used 410 | mutate | success invalidates/refreshes user state; 410 remains recoverable |
| **useResendVerification — cooldown** | fake timers and successful resend | invoke resend twice | second send is blocked during `RESEND_COOLDOWN_MS`; returned state exposes cooldown |
| **useResendVerification — server failure** | mock error | invoke resend | error is exposed and cooldown behavior follows specified state contract |
| **simple auth hooks** | mock corresponding endpoint | exercise each mutation hook | calls the correct endpoint/body, uses no automatic mutation retry, and exposes pending/error/data consistently |

## 9.2.5 Billing hooks

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useSubscription — initial query** | mock EP-15 | render hook | uses `queryKeys.subscription` and exposes subscription/hasAccess |
| **useSubscription — polling** | fake timers; active checkout confirmation state | advance polling interval | polls according to checkout rules and stops at max duration |
| **useStartCheckout — success** | mock EP-22 with checkout URL | mutate | returns checkout URL and does not mark subscription active locally |
| **useStartCheckout — failure** | mock 402/409/502 | mutate | exposes mapped error and does not retry mutation |
| **useCancelSubscription — success** | mock EP-23 success | mutate | invalidates/refetches subscription state |
| **useCancelSubscription — timeout** | mock timeout then successful refetch | mutate | refetches so UI can reflect already-canceled state |
| **usePayments — list** | mock EP-24 | render hook | uses `queryKeys.payments` and exposes newest-first API data without client sorting |
| **Checkout polling boundaries** | fake clock at just before/at max | advance time | stops at `CHECKOUT_POLL_MAX_MS` and shows timed-out state rather than claiming payment success |

## 9.2.6 GitHub hooks

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useGitHubConnection — connected** | mock EP-20 | render | returns connection summary under correct query key |
| **useGitHubConnection — 403** | mock 403 | render | global error handling invalidates GitHub connection; UI can show reconnect message |
| **useGitHubConnect — success** | mock EP-26 authorize URL | mutate | navigates/redirects to GitHub URL; does not store OAuth attempt |
| **useGitHubConnect — no access** | mock 402 | mutate | does not redirect to GitHub; exposes billing error |
| **useDisconnectGitHub — success** | mock EP-27 | mutate | invalidates connection and leaves repository data intact at UI level |
| **useCreateRepo — success** | mock EP-28 | mutate supported template | invalidates connection/current-ticket dependent queries as specified and exposes created repo |
| **useCreateRepo — unsupported/invalid** | schema-invalid input | mutate | does not call API |
| **useCreateRepo — 403/502** | mock GitHub/provider failure | mutate | exposes mapped error and never auto-retries mutation |

## 9.2.7 Ticket hooks

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useCurrentTicket — success/null** | mock EP-24 current ticket response | render | returns ticket or null and uses `queryKeys.currentTicket` |
| **useTicket — success** | mock EP-25 for ticket ID | render | uses `queryKeys.ticket(id)` and returns the ticket |
| **useTicket — ownership 404/400** | mock not-found style response | render | exposes not-found state without revealing whether another user's resource exists |
| **useAssignTicket — success** | mock EP-23 success | mutate | invalidates/refetches current ticket and setup progress |
| **useAssignTicket — 409 race** | mock 409 | mutate | refetches current ticket so the winner's ticket appears |
| **useStartTicket — success** | mock EP-26/appropriate start endpoint response | mutate | updates/refetches ticket state |
| **useAbandonTicket — success** | mock abandon result with optional new ticket | mutate | updates ticket/current-ticket cache according to result |
| **useAbandonTicket — new ticket failure** | abandon succeeds; next-ticket request fails | mutate | does not corrupt old/new ticket cache; exposes the next-ticket failure |

## 9.2.8 Mentor hooks and pending-message behavior

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useMentorMessages — history** | mock EP-29 | render | returns messages in API order under `queryKeys.mentor(id)` |
| **useSendMentorMessage — success** | mock EP-30 success | mutate | invalidates/refetches mentor history; no duplicate mutation retry |
| **useSendMentorMessage — 409** | mock 409 after ticket leaves progress | mutate | exposes error for pending-message reconciliation |
| **Mentor pending reconciliation — new message** | history count increases after send | run reconciliation | pending message is resolved/removed and real mentor response appears |
| **Mentor pending reconciliation — send succeeds but history is delayed** | send resolves before history count changes | advance configured reconciliation/refetch behavior | does not duplicate a pending user message |
| **Mentor pending reconciliation — retry** | send fails and ticket remains eligible | invoke retry | resends the pending content once; no duplicate concurrent send |

## 9.2.9 Submission hooks and polling

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useSubmission — idle** | submission status completed/failed | render hook | does not poll continuously |
| **useSubmission — fast polling** | awaiting_ci/evaluating | advance fake timers | polls every `SUBMISSION_POLL_FAST_MS` initially |
| **useSubmission — slow polling** | polling lasts beyond `SUBMISSION_POLL_SLOW_AFTER_MS` | advance timers | switches to slow interval and exposes `showSlowHint` |
| **useSubmission — polling stop** | polling reaches `SUBMISSION_POLL_STOP_AFTER_MS` | advance timers | stops polling and exposes `pollingStopped` |
| **useSubmission — restart** | pollingStopped true | call `restartPolling` | restarts polling from the defined initial interval |
| **useSubmission — diff query** | diffOpen/includeDiff true | render hook | requests diff only when enabled and uses `queryKeys.submission(id, attempt, true)` |
| **useSubmitWork — success** | mock EP-30 submission creation | mutate | invalidates/refetches ticket/submission state; does not allow client-selected attempt |
| **useSubmitWork — timeout after server creation** | submission endpoint times out but refetch reveals new submission | mutate/refetch | UI moves forward without creating a duplicate |
| **useSubmitWork — stale resubmit 409** | mock specified 409 | mutate | exposes server message and does not retry |
| **useRetrySubmission — attempt comes from submission** | submission attempt 1 or 2 supplied by page state | mutate | sends no arbitrary user-selected third attempt and uses the displayed submission attempt |
| **useRetrySubmission — failure** | mock 502/409 | mutate | exposes mapped error; mutation is not automatically retried |

## 9.2.10 Profile and cross-cutting hooks

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **useExperienceProfile — success** | mock EP-33 | render | returns profile items/count using `queryKeys.profile` |
| **useExperienceProfile — error** | mock 5xx/network | render | shows retryable query error without blanking unrelated app shell |
| **getSetupProgress — all done** | subscription access, connected GitHub, repo and active ticket | call pure helper | all four steps done; `setupComplete` true; `canGetTicket` false when active ticket exists |
| **getSetupProgress — initial setup** | not subscribed/disconnected/no repo/no ticket | call helper | steps 1-4 derived correctly; next step is subscribe |
| **getSetupProgress — lapsed subscription** | subscription exists but hasAccess false | call helper | step 1 is todo and labeled Subscribe again |
| **getSetupProgress — disconnected with repo** | connected false, repo present | call helper | step 2 todo/reconnect, step 3 done |
| **getSetupProgress — loading/error** | each query pending/error | call helper | corresponding step is loading/error; `nextStep` is null when first incomplete step is still unknown |
| **useSetupProgress retry** | one or more queries error | call retry | refetches only errored queries |
| **useUnsavedChangesWarning — dirty navigation** | isDirty true | navigate to different pathname | blocks navigation and exposes confirm/cancel controls |
| **useUnsavedChangesWarning — query/hash only** | isDirty true | change only search/hash | does not block |
| **useUnsavedChangesWarning — session expiry** | dirty form; navigation notice session_expired | trigger navigation | does not block session-expiry redirect |
| **useUnsavedChangesWarning — beforeunload** | isDirty true | dispatch beforeunload | calls preventDefault and sets returnValue |
| **useUnsavedChangesWarning — cleanup** | toggle dirty false/unmount | inspect listeners/blocker | removes listeners/blocker |
| **useDocumentTitle — title** | render with title | mount/update/unmount | sets document title to specified page title |
| **useFocusPageHeading — heading focus** | page contains `h1[tabIndex=-1]` | render/mount | focuses page heading without breaking normal keyboard flow |

## 9.2.11 Routing components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **RequireAuth — pending** | useMe pending | render | shows `FullPageLoader` |
| **RequireAuth — first-load 401** | useMe 401 | render | redirects to safe login URL with `from`; does not add session-expired notice |
| **RequireAuth — network/5xx** | useMe non-401 error | render | shows centered `ErrorState` with Retry; does not redirect |
| **RequireAuth — success** | useMe success | render | renders protected children |
| **PublicOnly — pending** | useMe pending | render | shows loader |
| **PublicOnly — authenticated** | useMe success plus safe from | render | replaces with safe redirect |
| **PublicOnly — error** | 401/network error | render | renders public children |
| **RootRedirect — pending/success/error** | mock each useMe state | render | loader for pending; dashboard on success; login on error |

## 9.2.12 Layout components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **AuthLayout — shell** | render child | inspect DOM | centered `main#main-content`, no navigation/external resources, child rendered |
| **AppLayout — desktop navigation** | mock current ticket and user/logout | render at desktop | brand/dashboard/ticket/profile/user-menu links appear according to state; active link has `aria-current` |
| **AppLayout — ticket link states** | current-ticket loading/error/null/success | render | ticket link hidden for loading/error/null and shown for existing ticket |
| **AppLayout — mobile menu** | render at mobile | open menu | all required navigation links appear; menu closes after navigation |
| **AppLayout — logout failure** | mock non-401 logout failure | click logout | shows specified toast and remains on page |
| **FullPageLoader — accessibility** | render | inspect roles/text | centered `role=status` with accessible Loading text |
| **EmailVerificationBanner — verified/unverified** | mock user verified/unverified | render | banner appears only when appropriate and provides specified verify/resend actions |
| **SubscriptionBanner — access states** | mock subscription states | render | shows only the specified access/banner content and links |

## 9.2.13 Common UI components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **PasswordInput — hidden by default** | render with current/new autocomplete | inspect input | input type is password and no value is prefilled |
| **PasswordInput — toggle** | click Show password then Hide password | inspect | type toggles, accessible name/aria-pressed update, no form submission |
| **PasswordInput — not persisted** | toggle then unmount/remount | render | starts hidden again |
| **FormRootError — absent/present** | render with null and message | inspect | null when absent; `role=alert` with text when present |
| **SubmitButton — pending** | isPending true | render/click | disabled, aria-busy true, spinner hidden from assistive tech, pendingLabel shown |
| **SubmitButton — disabled** | disabled true | render | disabled even when not pending |
| **SubmitButton — type** | omit type / set button type | render | defaults to submit and respects explicit type |
| **ErrorState — with retry** | message + onRetry | render/click | message shown and retry action invokes callback |
| **ErrorState — without retry** | message only | render | no retry control |
| **EmptyState — content/action** | render variants | inspect | renders specified message and optional action accessibly |
| **StatusBadge — domain/status** | render ticket/subscription/payment/CI statuses | inspect | uses correct labels and does not expose unknown raw statuses incorrectly |
| **ConfirmDialog — cancel/confirm** | render open dialog | click Stay/Leave | calls corresponding callbacks and exposes dialog semantics |
| **ExternalLink — external target** | render URL | inspect/click | opens external destination according to specified safe-link attributes and accessible name |
| **CopyButton — success** | mock clipboard write success | click | copies exact text and announces Copied for `COPY_FEEDBACK_MS` |
| **CopyButton — failure** | clipboard rejects | click | shows non-success state without falsely claiming Copied |

## 9.2.14 Billing, GitHub and dashboard components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **SubscriptionCard — every view kind** | mock each `getSubscriptionView` kind | render | matches specified text/button state for each kind |
| **SubscriptionCard — no price** | active/past-due/etc. | inspect | never renders a price |
| **SubscriptionCard — past due** | past_due_access/ended | render | no action button is offered per Q-15 |
| **SubscriptionCard — subscribe pending** | isSubscribing true | render/click | button disabled and label Opening Chapa… |
| **SubscriptionCard — subscribe error** | UiError with server message | render | shows mapped server message inline |
| **PaymentHistory — empty** | payments=[] | render | shows No payments yet |
| **PaymentHistory — paidAt fallback** | payment with null paidAt | render | uses createdAt |
| **PaymentHistory — responsive duplicate prevention** | render at desktop/mobile | inspect accessibility tree | only visible representation is exposed; hidden duplicate is not screen-reader accessible |
| **GitHubConnectionCard — disconnected** | connected false | render | shows explanation and Connect |
| **GitHubConnectionCard — connected** | connected true | render | shows login and Disconnect |
| **GitHubConnectionCard — no access** | hasAccess false | render | Connect disabled with billing reason/link |
| **GitHubConnectionCard — OAuth result** | success/error/unknown result | render | success is status alert; known error has mapped message; unknown reason is not echoed |
| **RepoCreateForm — valid templates** | react/node_express values | submit | calls onCreate with validated values |
| **RepoCreateForm — invalid input** | unsupported/invalid repo name | submit | blocks submit and shows field validation |
| **RepoCreateForm — pending** | isCreating true | render | fields/actions disabled and pending label shown |
| **RepoSummary — repo links** | repo summary | render | shows repo/default branch data with safe external links |
| **SetupChecklist — four steps** | progress states | render | always shows four steps in required order with correct status/detail and next-step action |
| **CurrentTicketCard — setup blocked** | setupComplete false | render | shows Finish setup to get a ticket and does not offer get-ticket action |
| **CurrentTicketCard — ticket present** | ticket present | render | shows ticket summary and correct phase/status label |
| **CurrentTicketCard — no ticket** | setup complete, no ticket | render | shows Get ticket action and inline get-ticket errors |

## 9.2.15 Ticket workspace components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **TicketHeader** | ticket + phase | render | renders title, ticket-phase badge, category and difficulty |
| **TicketActionBar — primary action** | each phase action | render/click | shows only the specified action and invokes `onAction`; never calls mutation directly |
| **TicketActionBar — access blocked** | hasAccess false | render | disables action and shows billing reason/link |
| **TicketActionBar — pending** | pendingAction set | render | all action buttons disabled and pending label displayed |
| **TicketActionBar — error recovery links** | UiError go_billing/reconnect_github | render | adds matching link |
| **TicketDetails — lists** | scenario/files/criteria/checklist populated and empty | render | preserves scenario whitespace, renders read-only lists, hides empty sections |
| **BranchInstructions — links/commands** | repo/branch including spaces and quotes | render/copy | builds repo/branch links and safely quoted checkout command |
| **MentorPanel — availability order** | each mentor availability + access combination | render | applies availability precedence exactly as specified |
| **MentorPanel — successful send reconciliation** | mock send + history count increase | send | pending user message reconciles into real history |
| **MentorPanel — 409 after leaving progress** | send then 409 | send | pending becomes failed and Retry is hidden |
| **MentorPanel — duplicate send** | sending in progress | send twice | second send ignored |
| **MentorMessageList — roles/text** | user/mentor messages with HTML-like content | render | shows You/Mentor labels and raw text; never interprets HTML/Markdown |
| **MentorMessageList — pending states** | sending and failed pending message | render | shows Mentor is thinking… or Not sent + Retry according to state |
| **MentorComposer — empty/send** | empty, whitespace, valid text | interact | Send disabled for empty; trims valid content before callback and clears textarea after callback |
| **MentorComposer — sending/disabled/max** | isSending, disabledReason, known maxChars | render/type | button disabled appropriately; counter appears only when maxChars is known; over-limit cannot send |
| **MentorComposer — Enter** | type multiline text | press Enter | inserts newline; does not submit |
| **SubmissionsPanel — ordering** | attempts unordered | render | cards appear in attempt order |
| **SubmissionsPanel — empty** | no submissions | render | shows specified empty message |
| **SubmissionsPanel — retry gate** | phase retryAttempt matches/mismatches; access true/false | render | Retry enabled only when attempt and access both permit |
| **SubmissionCard — attempt labels** | attempt 1/2 | render | correct heading; attempt 1 explicitly says feedback only/not scored |
| **SubmissionCard — status/CI** | awaiting_ci/evaluating/completed/failed and CI states | render | shows correct status/CI badges and status-region messages |
| **SubmissionCard — polling** | processing submission | advance fake timers | polls; stops/reconciles exactly once when completed/failed |
| **SubmissionCard — slow/stopped** | polling exceeds slow/stop thresholds | advance timers | shows slow hint then stops at maximum |
| **SubmissionCard — diff lazy load** | diff closed/open | toggle | diff query only runs when opened |
| **SubmissionCard — attempt 1 score** | attempt 1 with scores accidentally present | render | never shows score |
| **EvaluationView — attempt 1** | evaluation with scores present | render | shows feedback + Not scored only |
| **EvaluationView — attempt 2 scores** | scores present | render | renders ScoreBreakdown |
| **EvaluationView — missing scores** | attempt 2, scores null | render | shows Score unavailable; no crash |
| **ScoreBreakdown — rubric display** | known scores | render | four rubric rows in configured order, exact weights, scores formatted, total from `scores.total` |
| **ScoreBreakdown — no arithmetic** | scores whose total differs from hand sum | render | displays API total unchanged |
| **ScoreBreakdown — bar clamping** | score below 0/above 100 | render | bar width is clamped but displayed number is not |
| **DiffViewer — line classes** | added/removed/hunk/context lines including +++/--- | render | classifies correctly while retaining leading +/- characters |
| **DiffViewer — empty** | diff='' | render | shows No changes in this diff |
| **DiffViewer — text safety** | diff contains HTML/script-looking text | render | renders literal text, never HTML |
| **DiffViewer — line endings/large diff** | CRLF and large diff | render | removes trailing CR per line and renders full diff without page horizontal overflow |

## 9.2.16 Profile components

| Case | Setup | Action | Expected result |
|---|---|---|---|
| **PracticeRecordNotice — exact text** | render | inspect | always renders exact FR-51 notice |
| **PracticeRecordNotice — cannot hide** | render under different parent states | inspect | notice remains present |
| **ExperienceItem — metadata** | profile item | render | shows title/category/difficulty and formatted completion date |
| **ExperienceItem — scores** | valid scores | render | delegates score display to ScoreBreakdown with no arithmetic |
| **ExperienceItem — unavailable score** | scores null | render | shows Score unavailable and does not crash |
| **ExperienceItem — feedback toggle** | long feedback | click Show full feedback | toggles `aria-expanded` and visible feedback |
| **ExperienceItem — history link** | ticket id | render | links to `/tickets/{ticketId}?tab=submissions` |
| **ExperienceItem — no share** | render | inspect actions | no share button/link exists |

## 9.2.17 `PG-01 RegisterPage` page test

**Source:** `frontend/src/pages/auth/RegisterPage.tsx`  
**Test file:** `frontend/tests/pages/auth/RegisterPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **initial form** | render page | inspect | Create account title and required fields are present; no success view |
| **validation** | invalid email/password/name | submit | client validation prevents request and shows field errors |
| **success** | mock register success | submit valid form | shows success view, keeps registered email for resend, does not navigate/log in |
| **server 409** | register returns 409 | submit | email field receives server error and focus moves to email |
| **resend** | success view + resend hook | click Resend | uses registered email and displays server resend message unchanged |
| **pending** | mutation pending | render/interact | fields/actions are read-only/disabled while pending |

## 9.2.17 `PG-02 LoginPage` page test

**Source:** `frontend/src/pages/auth/LoginPage.tsx`  
**Test file:** `frontend/tests/pages/auth/LoginPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **notice mapping** | session_expired/password_reset/logged_out_all/unknown notice | render | known notices map to exact text; unknown is ignored |
| **successful login** | mock login success + safe/unsafe from | submit | navigates with replace to safe redirect; unsafe from falls back |
| **401** | login returns 401 | submit | password field reset/focused; server error shown |
| **429** | login returns 429 | submit | root error shown and form remains usable |
| **no remember me** | render | inspect | no remember-me control exists |

## 9.2.17 `PG-03 ForgotPasswordPage` page test

**Source:** `frontend/src/pages/auth/ForgotPasswordPage.tsx`  
**Test file:** `frontend/tests/pages/auth/ForgotPasswordPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **success** | mock success message | submit valid email | shows exact server message with no account-existence hint |
| **different email** | success view | click use different email | clears sent message and resets form |
| **failure** | server error | submit | shows mapped form/root error |

## 9.2.17 `PG-04 ResetPasswordPage` page test

**Source:** `frontend/src/pages/auth/ResetPasswordPage.tsx`  
**Test file:** `frontend/tests/pages/auth/ResetPasswordPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **valid reset** | valid token in URL + success | submit | resets password and shows specified success state |
| **invalid link** | 400 exact invalid-reset message | submit | shows invalid-link view and Request a new link to `/forgot-password` |
| **expired/used** | 410 | render/submit | shows recovery; does not perform client-side mutation |
| **refresh token preservation** | token in URL | reload/remount | token remains usable and is not stripped |

## 9.2.17 `PG-05 VerifyEmailPage` page test

**Source:** `frontend/src/pages/auth/VerifyEmailPage.tsx`  
**Test file:** `frontend/tests/pages/auth/VerifyEmailPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **successful verification** | mock EP-06 success | render | shows success; button goes dashboard when useMe has user, otherwise login |
| **expired/used** | EP-06 410 | render | both use same resend recovery without message matching |
| **prefill** | useMe has user email | render | resend email is prefilled |
| **logged out** | useMe 401 | render | page remains usable and does not treat 401 as a crash |
| **strict-mode double effect** | development-style double effect | render | verification request is not duplicated |

## 9.2.17 `PG-06 DashboardPage` page test

**Source:** `frontend/src/pages/dashboard/DashboardPage.tsx`  
**Test file:** `frontend/tests/pages/dashboard/DashboardPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **setup blocked** | setupComplete false | render | get-ticket action is blocked with exact reason |
| **independent cards** | one query/card errors while others succeed | render | failed card shows its own error; page remains usable |
| **get ticket success** | mock assign success | click get ticket | current ticket appears and setup progress updates |
| **get ticket race** | two callers; one 409 | trigger | loser refetches and displays winner's ticket |
| **get ticket timeout** | EP-23 timeout then refetch finds ticket | trigger | refetch recovers without duplicate ticket |
| **access lapse** | setup complete then hasAccess false | render | step 1 says Subscribe again |

## 9.2.17 `PG-07 BillingPage` page test

**Source:** `frontend/src/pages/billing/BillingPage.tsx`  
**Test file:** `frontend/tests/pages/billing/BillingPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **checkout** | mock start checkout URL | click Subscribe | same-tab navigation/redirect occurs; page does not mark subscribed itself |
| **double checkout** | checkout in progress | click twice | second click is disabled |
| **cancel confirmation** | active subscription | click Cancel | specified confirmation dialog text appears |
| **cancel success** | mock cancel success | confirm | subscription state refetches |
| **cancel timeout** | timeout but backend may have canceled | cancel | hook refetches and card can show Canceled |
| **checkout 409** | active subscription appears in another tab | click | server error shown; no false success |

## 9.2.17 `PG-08 CheckoutReturnPage` page test

**Source:** `frontend/src/pages/billing/CheckoutReturnPage.tsx`  
**Test file:** `frontend/tests/pages/billing/CheckoutReturnPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **confirming** | subscription data pending/not active | render/poll | shows confirming state |
| **confirmed** | EP-15 returns active + hasAccess true | poll | shows subscribed/confirmed state |
| **timed out** | poll reaches max without confirmation | advance fake timers | shows timed-out state |
| **error** | query fails with no data | render | shows error state |
| **intermittent error** | previous data exists then poll fails | poll | keeps confirming rather than showing terminal error |
| **query params ignored** | Chapa params present | render | does not trust query params to claim payment success |
| **GitHub link** | confirmed state | render/click | Connect GitHub points to `/github` |

## 9.2.17 `PG-09 GitHubSetupPage` page test

**Source:** `frontend/src/pages/github/GitHubSetupPage.tsx`  
**Test file:** `frontend/tests/pages/github/GitHubSetupPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **blocked repo creation** | not connected / no access | render | shows exact blocked reason and correct link |
| **OAuth success** | callback result success | render | shows connected state and dismissible success |
| **OAuth unknown reason** | unknown callback reason | render | generic error; raw reason not echoed |
| **403 mid-session** | repo action returns 403 | trigger | connection refetches and server message is shown |
| **repo with disconnected GitHub** | repo exists, connection false | render | Connect shown while RepoSummary remains |
| **stripped params refresh** | callback params absent after refresh | render | no stale OAuth alert is fabricated |

## 9.2.17 `PG-10 TicketPage` page test

**Source:** `frontend/src/pages/tickets/TicketPage.tsx`  
**Test file:** `frontend/tests/pages/tickets/TicketPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **loading/title** | ticket query pending | render | title is Ticket and loading UI is shown |
| **not found** | useTicket returns 404/400 | render | identical Ticket not found state with dashboard link |
| **phase action** | each phase | render/click | only phase primary action is available |
| **abandon** | phase canAbandon true/false; access true/false | render | abandon only appears/enables when allowed |
| **billing/github errors** | 402/403 | render | banner/link shown; page remains readable |
| **third submission impossible** | attempts 1 and 2 | inspect | no third submission control or client attempt selector |
| **two-tab race** | start/submit/abandon 409 | trigger | refetches and catches screen up |
| **submit timeout** | mutation timeout + refetch | trigger | moves phase forward if backend created submission; no duplicate |
| **completed submission before ticket** | submission completed while ticket still resubmitted | poll | sync loop refetches until ticket reaches final state |
| **abandon then next-ticket failure** | abandon succeeds; new ticket request fails | trigger | old state is not corrupted; error remains recoverable |

## 9.2.17 `PG-11 ExperienceProfilePage` page test

**Source:** `frontend/src/pages/profile/ExperienceProfilePage.tsx`  
**Test file:** `frontend/tests/pages/profile/ExperienceProfilePage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **notice all states** | loading/empty/error/success | render | PracticeRecordNotice always appears |
| **count pluralization** | 0/1/many completed items | render | uses singular/plural exact wording |
| **ordering** | API returns known order | render | items render in API order |
| **empty state** | no items | render | specified empty message/action |
| **error** | profile query fails | render | error state with retry |

## 9.2.17 `PG-12 SettingsPage` page test

**Source:** `frontend/src/pages/settings/SettingsPage.tsx`  
**Test file:** `frontend/tests/pages/settings/SettingsPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **load** | mock current user | render | settings fields are populated from user data |
| **profile save** | valid name | submit | updates profile and clears dirty state before navigation |
| **change password** | valid/current-password error/validation error | submit | maps server errors to correct fields/root |
| **dirty navigation** | unsaved changes | navigate | ConfirmDialog blocks navigation |
| **session expiry while dirty** | session expiry redirect | trigger | does not block logout/session-expiry navigation |
| **successful save** | dirty form | submit | dirty state resets before any navigation |

## 9.2.17 `PG-13 NotFoundPage` page test

**Source:** `frontend/src/pages/NotFoundPage.tsx`  
**Test file:** `frontend/tests/pages/NotFoundPage.test.tsx`


| Case | Setup | Action | Expected result |
|---|---|---|---|
| **logged out** | useMe 401 | render | uses AuthLayout + not-found content |
| **logged in** | useMe success | render | uses AppLayout + not-found content |
| **pending** | useMe pending | render | uses FullPageLoader |
| **recovery** | render | inspect | provides specified navigation back into the app |

## 9.3 Component/Page Contract Coverage Checklist

The following checklist ensures no function-level specification block is skipped even when a behavior is covered by a neighboring test. Each row must have at least one direct contract test in its named file.

| Source function/component/page | Required test file | Covered? |
|---|---|---|

| `apiRequest` — `frontend/src/lib/api/client.ts` | `frontend/tests/lib/api/client.test.ts` | ☐ |
| `configureApiClient` — `frontend/src/lib/api/client.ts` | `frontend/tests/lib/api/client.test.ts` | ☐ |
| `refreshSessionOnce` — `frontend/src/lib/api/client.ts` | `frontend/tests/lib/api/client.test.ts` | ☐ |
| `resetSessionExpiredGuard` — `frontend/src/lib/api/client.ts` | `frontend/tests/lib/api/client.test.ts` | ☐ |
| `mapApiError` — `frontend/src/lib/api/errors.ts` | `frontend/tests/lib/api/errors.test.ts` | ☐ |
| `applyServerErrorToForm` — `frontend/src/lib/api/errors.ts` | `frontend/tests/lib/api/errors.test.ts` | ☐ |
| `handleGlobalApiError` — `frontend/src/lib/api/errors.ts` | `frontend/tests/lib/api/errors.test.ts` | ☐ |
| `shouldRetryQuery` — `frontend/src/lib/api/errors.ts` | `frontend/tests/lib/api/errors.test.ts` | ☐ |
| `getTicketPhase` — `frontend/src/lib/ticket-phase.ts` | `frontend/tests/lib/ticket-phase.test.ts` | ☐ |
| `getTicketStatusLabel` — `frontend/src/lib/ticket-phase.ts` | `frontend/tests/lib/ticket-phase.test.ts` | ☐ |
| `getSubscriptionView` — `frontend/src/lib/subscription-view.ts` | `frontend/tests/lib/subscription-view.test.ts` | ☐ |
| `getSafeRedirectPath and buildLoginRedirect` — `frontend/src/lib/navigation.ts` | `frontend/tests/lib/navigation.test.ts` | ☐ |
| `Formatters` — `frontend/src/lib/format.ts` | `frontend/tests/lib/format.test.ts` | ☐ |
| `GitHub helpers` — `frontend/src/lib/github.ts` | `frontend/tests/lib/github.test.ts` | ☐ |
| `useMe` — `frontend/src/hooks/auth/useMe.ts` | `frontend/tests/hooks/auth/useMe.test.tsx` | ☐ |
| `useLogin` — `frontend/src/hooks/auth/useLogin.ts` | `frontend/tests/hooks/auth/useLogin.test.tsx` | ☐ |
| `useLogout` — `frontend/src/hooks/auth/useLogout.ts` | `frontend/tests/hooks/auth/useLogout.test.tsx` | ☐ |
| `useVerifyEmail` — `frontend/src/hooks/auth/useVerifyEmail.ts` | `frontend/tests/hooks/auth/useVerifyEmail.test.tsx` | ☐ |
| `useResendVerification` — `frontend/src/hooks/auth/useResendVerification.ts` | `frontend/tests/hooks/auth/useResendVerification.test.tsx` | ☐ |
| `useSubscription` — `frontend/src/hooks/billing/useSubscription.ts` | `frontend/tests/hooks/billing/useSubscription.test.tsx` | ☐ |
| `useStartCheckout` — `frontend/src/hooks/billing/useStartCheckout.ts` | `frontend/tests/hooks/billing/useStartCheckout.test.tsx` | ☐ |
| `useCancelSubscription` — `frontend/src/hooks/billing/useCancelSubscription.ts` | `frontend/tests/hooks/billing/useCancelSubscription.test.tsx` | ☐ |
| `usePayments` — `frontend/src/hooks/billing/usePayments.ts` | `frontend/tests/hooks/billing/usePayments.test.tsx` | ☐ |
| `useGitHubConnection` — `frontend/src/hooks/github/useGitHubConnection.ts` | `frontend/tests/hooks/github/useGitHubConnection.test.tsx` | ☐ |
| `useGitHubConnect` — `frontend/src/hooks/github/useGitHubConnect.ts` | `frontend/tests/hooks/github/useGitHubConnect.test.tsx` | ☐ |
| `useDisconnectGitHub` — `frontend/src/hooks/github/useDisconnectGitHub.ts` | `frontend/tests/hooks/github/useDisconnectGitHub.test.tsx` | ☐ |
| `useCreateRepo` — `frontend/src/hooks/github/useCreateRepo.ts` | `frontend/tests/hooks/github/useCreateRepo.test.tsx` | ☐ |
| `useCurrentTicket` — `frontend/src/hooks/tickets/useCurrentTicket.ts` | `frontend/tests/hooks/tickets/useCurrentTicket.test.tsx` | ☐ |
| `useTicket` — `frontend/src/hooks/tickets/useTicket.ts` | `frontend/tests/hooks/tickets/useTicket.test.tsx` | ☐ |
| `useAssignTicket` — `frontend/src/hooks/tickets/useAssignTicket.ts` | `frontend/tests/hooks/tickets/useAssignTicket.test.tsx` | ☐ |
| `useStartTicket` — `frontend/src/hooks/tickets/useStartTicket.ts` | `frontend/tests/hooks/tickets/useStartTicket.test.tsx` | ☐ |
| `useAbandonTicket` — `frontend/src/hooks/tickets/useAbandonTicket.ts` | `frontend/tests/hooks/tickets/useAbandonTicket.test.tsx` | ☐ |
| `useMentorMessages` — `frontend/src/hooks/mentor/useMentorMessages.ts` | `frontend/tests/hooks/mentor/useMentorMessages.test.tsx` | ☐ |
| `useSendMentorMessage` — `frontend/src/hooks/mentor/useSendMentorMessage.ts` | `frontend/tests/hooks/mentor/useSendMentorMessage.test.tsx` | ☐ |
| `useSubmission` — `frontend/src/hooks/submissions/useSubmission.ts` | `frontend/tests/hooks/submissions/useSubmission.test.tsx` | ☐ |
| `useSubmitWork` — `frontend/src/hooks/submissions/useSubmitWork.ts` | `frontend/tests/hooks/submissions/useSubmitWork.test.tsx` | ☐ |
| `useRetrySubmission` — `frontend/src/hooks/submissions/useRetrySubmission.ts` | `frontend/tests/hooks/submissions/useRetrySubmission.test.tsx` | ☐ |
| `useExperienceProfile` — `frontend/src/hooks/profile/useExperienceProfile.ts` | `frontend/tests/hooks/profile/useExperienceProfile.test.tsx` | ☐ |
| `getSetupProgress and useSetupProgress` — `frontend/src/hooks/useSetupProgress.ts` | `frontend/tests/hooks/useSetupProgress.test.tsx` | ☐ |
| `useUnsavedChangesWarning` — `frontend/src/hooks/useUnsavedChangesWarning.ts` | `frontend/tests/hooks/useUnsavedChangesWarning.test.tsx` | ☐ |
| `useDocumentTitle and useFocusPageHeading` — `frontend/src/hooks/useDocumentTitle.ts` | `frontend/tests/hooks/useDocumentTitle.test.tsx` | ☐ |
| `RequireAuth` — `frontend/src/routes/RequireAuth.tsx` | `frontend/tests/routes/RequireAuth.test.tsx` | ☐ |
| `PublicOnly` — `frontend/src/routes/PublicOnly.tsx` | `frontend/tests/routes/PublicOnly.test.tsx` | ☐ |
| `RootRedirect` — `frontend/src/routes/RootRedirect.tsx` | `frontend/tests/routes/RootRedirect.test.tsx` | ☐ |
| `AuthLayout` — `frontend/src/components/layout/AuthLayout.tsx` | `frontend/tests/components/layout/AuthLayout.test.tsx` | ☐ |
| `AppLayout` — `frontend/src/components/layout/AppLayout.tsx` | `frontend/tests/components/layout/AppLayout.test.tsx` | ☐ |
| `FullPageLoader` — `frontend/src/components/layout/FullPageLoader.tsx` | `frontend/tests/components/layout/FullPageLoader.test.tsx` | ☐ |
| `EmailVerificationBanner` — `frontend/src/components/layout/EmailVerificationBanner.tsx` | `frontend/tests/components/layout/EmailVerificationBanner.test.tsx` | ☐ |
| `SubscriptionBanner` — `frontend/src/components/layout/SubscriptionBanner.tsx` | `frontend/tests/components/layout/SubscriptionBanner.test.tsx` | ☐ |
| `PasswordInput` — `frontend/src/components/common/PasswordInput.tsx` | `frontend/tests/components/common/PasswordInput.test.tsx` | ☐ |
| `FormRootError` — `frontend/src/components/common/FormRootError.tsx` | `frontend/tests/components/common/FormRootError.test.tsx` | ☐ |
| `SubmitButton` — `frontend/src/components/common/SubmitButton.tsx` | `frontend/tests/components/common/SubmitButton.test.tsx` | ☐ |
| `ErrorState` — `frontend/src/components/common/ErrorState.tsx` | `frontend/tests/components/common/ErrorState.test.tsx` | ☐ |
| `EmptyState` — `frontend/src/components/common/EmptyState.tsx` | `frontend/tests/components/common/EmptyState.test.tsx` | ☐ |
| `StatusBadge` — `frontend/src/components/common/StatusBadge.tsx` | `frontend/tests/components/common/StatusBadge.test.tsx` | ☐ |
| `ConfirmDialog` — `frontend/src/components/common/ConfirmDialog.tsx` | `frontend/tests/components/common/ConfirmDialog.test.tsx` | ☐ |
| `ExternalLink` — `frontend/src/components/common/ExternalLink.tsx` | `frontend/tests/components/common/ExternalLink.test.tsx` | ☐ |
| `CopyButton` — `frontend/src/components/common/CopyButton.tsx` | `frontend/tests/components/common/CopyButton.test.tsx` | ☐ |
| `SubscriptionCard` — `frontend/src/components/billing/SubscriptionCard.tsx` | `frontend/tests/components/billing/SubscriptionCard.test.tsx` | ☐ |
| `PaymentHistory` — `frontend/src/components/billing/PaymentHistory.tsx` | `frontend/tests/components/billing/PaymentHistory.test.tsx` | ☐ |
| `GitHubConnectionCard` — `frontend/src/components/github/GitHubConnectionCard.tsx` | `frontend/tests/components/github/GitHubConnectionCard.test.tsx` | ☐ |
| `RepoCreateForm` — `frontend/src/components/github/RepoCreateForm.tsx` | `frontend/tests/components/github/RepoCreateForm.test.tsx` | ☐ |
| `RepoSummary` — `frontend/src/components/github/RepoSummary.tsx` | `frontend/tests/components/github/RepoSummary.test.tsx` | ☐ |
| `SetupChecklist` — `frontend/src/components/dashboard/SetupChecklist.tsx` | `frontend/tests/components/dashboard/SetupChecklist.test.tsx` | ☐ |
| `CurrentTicketCard` — `frontend/src/components/dashboard/CurrentTicketCard.tsx` | `frontend/tests/components/dashboard/CurrentTicketCard.test.tsx` | ☐ |
| `TicketHeader` — `frontend/src/components/ticket/TicketHeader.tsx` | `frontend/tests/components/ticket/TicketHeader.test.tsx` | ☐ |
| `TicketActionBar` — `frontend/src/components/ticket/TicketActionBar.tsx` | `frontend/tests/components/ticket/TicketActionBar.test.tsx` | ☐ |
| `TicketDetails` — `frontend/src/components/ticket/TicketDetails.tsx` | `frontend/tests/components/ticket/TicketDetails.test.tsx` | ☐ |
| `BranchInstructions` — `frontend/src/components/ticket/BranchInstructions.tsx` | `frontend/tests/components/ticket/BranchInstructions.test.tsx` | ☐ |
| `MentorPanel` — `frontend/src/components/ticket/MentorPanel.tsx` | `frontend/tests/components/ticket/MentorPanel.test.tsx` | ☐ |
| `MentorMessageList` — `frontend/src/components/ticket/MentorMessageList.tsx` | `frontend/tests/components/ticket/MentorMessageList.test.tsx` | ☐ |
| `MentorComposer` — `frontend/src/components/ticket/MentorComposer.tsx` | `frontend/tests/components/ticket/MentorComposer.test.tsx` | ☐ |
| `SubmissionsPanel` — `frontend/src/components/ticket/SubmissionsPanel.tsx` | `frontend/tests/components/ticket/SubmissionsPanel.test.tsx` | ☐ |
| `SubmissionCard` — `frontend/src/components/ticket/SubmissionCard.tsx` | `frontend/tests/components/ticket/SubmissionCard.test.tsx` | ☐ |
| `EvaluationView` — `frontend/src/components/ticket/EvaluationView.tsx` | `frontend/tests/components/ticket/EvaluationView.test.tsx` | ☐ |
| `ScoreBreakdown` — `frontend/src/components/ticket/ScoreBreakdown.tsx` | `frontend/tests/components/ticket/ScoreBreakdown.test.tsx` | ☐ |
| `DiffViewer` — `frontend/src/components/ticket/DiffViewer.tsx` | `frontend/tests/components/ticket/DiffViewer.test.tsx` | ☐ |
| `PracticeRecordNotice` — `frontend/src/components/profile/PracticeRecordNotice.tsx` | `frontend/tests/components/profile/PracticeRecordNotice.test.tsx` | ☐ |
| `ExperienceItem` — `frontend/src/components/profile/ExperienceItem.tsx` | `frontend/tests/components/profile/ExperienceItem.test.tsx` | ☐ |
| `PG-01 RegisterPage` — `frontend/src/pages/auth/RegisterPage.tsx` | `frontend/tests/pages/auth/RegisterPage.test.tsx` | ☐ |
| `PG-02 LoginPage` — `frontend/src/pages/auth/LoginPage.tsx` | `frontend/tests/pages/auth/LoginPage.test.tsx` | ☐ |
| `PG-03 ForgotPasswordPage` — `frontend/src/pages/auth/ForgotPasswordPage.tsx` | `frontend/tests/pages/auth/ForgotPasswordPage.test.tsx` | ☐ |
| `PG-04 ResetPasswordPage` — `frontend/src/pages/auth/ResetPasswordPage.tsx` | `frontend/tests/pages/auth/ResetPasswordPage.test.tsx` | ☐ |
| `PG-05 VerifyEmailPage` — `frontend/src/pages/auth/VerifyEmailPage.tsx` | `frontend/tests/pages/auth/VerifyEmailPage.test.tsx` | ☐ |
| `PG-06 DashboardPage` — `frontend/src/pages/dashboard/DashboardPage.tsx` | `frontend/tests/pages/dashboard/DashboardPage.test.tsx` | ☐ |
| `PG-07 BillingPage` — `frontend/src/pages/billing/BillingPage.tsx` | `frontend/tests/pages/billing/BillingPage.test.tsx` | ☐ |
| `PG-08 CheckoutReturnPage` — `frontend/src/pages/billing/CheckoutReturnPage.tsx` | `frontend/tests/pages/billing/CheckoutReturnPage.test.tsx` | ☐ |
| `PG-09 GitHubSetupPage` — `frontend/src/pages/github/GitHubSetupPage.tsx` | `frontend/tests/pages/github/GitHubSetupPage.test.tsx` | ☐ |
| `PG-10 TicketPage` — `frontend/src/pages/tickets/TicketPage.tsx` | `frontend/tests/pages/tickets/TicketPage.test.tsx` | ☐ |
| `PG-11 ExperienceProfilePage` — `frontend/src/pages/profile/ExperienceProfilePage.tsx` | `frontend/tests/pages/profile/ExperienceProfilePage.test.tsx` | ☐ |
| `PG-12 SettingsPage` — `frontend/src/pages/settings/SettingsPage.tsx` | `frontend/tests/pages/settings/SettingsPage.test.tsx` | ☐ |
| `PG-13 NotFoundPage` — `frontend/src/pages/NotFoundPage.tsx` | `frontend/tests/pages/NotFoundPage.test.tsx` | ☐ |

## 9.4 Cross-Feature Integration Test Cases

These cases intentionally test the seams between the units above. They are not substitutes for unit/component tests.

### 9.4.1 Authentication and session

| Case | Setup | Action | Expected result |
|---|---|---|---|
| login → protected route | login succeeds and `me` cache is seeded | navigate to `/dashboard` | `PublicOnly` and `LoginPage` converge on the same safe destination; dashboard renders without a flash to login |
| protected route → expired access cookie | `useMe` request gets 401 and refresh succeeds | load protected page | API client refreshes once and replays; protected page renders |
| protected route → dead session | refresh returns 401 | load protected page | exactly one session-expiry navigation; login receives `session_expired` notice only for an existing session |
| many requests → one refresh | multiple protected queries return 401 together | resolve refresh | only one refresh request is made; all eligible requests replay once |
| logout all → login | logout-all succeeds | navigate/login | cache/session state is cleared and login notice is correct |
| password reset → login | reset succeeds | visit login | `password_reset` notice is shown exactly once |

### 9.4.2 Billing and access

| Case | Setup | Action | Expected result |
|---|---|---|---|
| checkout → return → active | start checkout returns URL; subscription polling eventually returns active + hasAccess | return/poll | page moves confirming → confirmed only from API data |
| checkout → timeout | polling never confirms | advance fake timers | timed-out state; never claims success |
| past_due → access | API says past_due with future end | render billing/ticket | access-dependent UI remains available according to `hasAccess`; no client-invented past-due action |
| access revoked → 402 | mutation/query returns 402 | render affected page | subscription cache invalidates and billing recovery link appears |
| cancel in another tab | local state active; cancel returns 409/updated state | attempt cancel | refetch catches server truth; no false local state |

### 9.4.3 GitHub setup

| Case | Setup | Action | Expected result |
|---|---|---|---|
| subscribe → connect → repo | access true, OAuth success, repo creation success | complete setup | each step moves done in order and setup progress derives state rather than storing it |
| OAuth failure | callback has known failure | land on GitHub page | typed result becomes safe UI text; no token/reason leakage |
| token revoked mid-session | GitHub action returns 403 | perform action | connection query invalidates/refetches; reconnect guidance appears |
| disconnect with repo | connected + repo exists | disconnect | connection becomes disconnected while repository summary remains |
| repo creation failure | GitHub provider returns 502 | create repo | no false repo is shown; error is retryable and mutation is not auto-retried |

### 9.4.4 Ticket lifecycle

| Case | Setup | Action | Expected result |
|---|---|---|---|
| assign → start → submit | setup complete and no active ticket | complete actions | phase transitions are derived from server ticket/submission state |
| first submission | in_progress | submit | attempt 1 appears; no score is shown |
| first feedback → resubmit | attempt 1 completed | resubmit | attempt 2 appears and final-review processing begins |
| final review → done | attempt 2 completes | poll/refetch | score appears only for attempt 2 and ticket eventually becomes done |
| review failure → retry | submission failed | retry | correct attempt is retried; no third attempt is offered |
| abandoned → next ticket | abandon succeeds | get next | route key resets page state and new ticket is shown when returned |
| ownership failure | request another user's ticket | navigate | same not-found view as any missing ticket |

### 9.4.5 Mentor

| Case | Setup | Action | Expected result |
|---|---|---|---|
| start → mentor send | in_progress + access | send message | pending message appears, then reconciles with server history |
| mentor unavailable after submit | ticket leaves in_progress | open/send | composer is disabled with specified reason |
| mentor send 409 | send begins then state changes | resolve mutation | pending message becomes failed and retry is hidden |
| duplicate click | send pending | click Send twice | exactly one request |
| HTML message | API returns `<script>`/HTML-like content | render | text is displayed literally |

### 9.4.6 Submission polling

| Case | Setup | Action | Expected result |
|---|---|---|---|
| CI wait | awaiting_ci | poll | fast polling initially and correct status message |
| slow review | evaluating beyond slow threshold | poll | slow interval + "taking longer" hint |
| stop | processing beyond maximum | poll | polling stops and UI exposes stopped state |
| completed reconciliation | poll becomes completed | render | `onSettled` fires once and ticket refetches |
| diff open | completed submission with diff | open diff | diff request is lazy and cached separately from summary |

## 9.5 Security, Privacy and Accessibility Checks

| Check | Expected result |
|---|---|
| Auth token handling | No frontend test should observe token reads/writes in localStorage, sessionStorage or IndexedDB; cookies remain browser-managed |
| API credentials | Every API request uses `credentials: 'include'` |
| Secret leakage | Sentinel refresh tokens, GitHub tokens, Chapa keys and API payloads never appear in UI or logs |
| HTML injection | Mentor text, feedback, failureReason and diff content render as text |
| Open redirect | `from` and login redirect helpers reject external/protocol-relative destinations |
| Ownership privacy | 404/400 ownership failures do not identify another user's resource |
| Payment privacy | No card/payment-detail fields are rendered or stored by frontend state |
| OAuth privacy | OAuth callback does not persist tokens or expose raw callback reason/token |
| Keyboard access | Dialogs, forms, buttons, tabs and navigation remain keyboard accessible |
| Focus | Page headings receive focus as specified; invalid form fields receive focus where specified |
| Live regions | Loading/status/error announcements use the specified ARIA roles |
| Reduced motion | Mentor list scroll behavior does not force smooth scrolling when reduced motion is preferred |
| Responsive accessibility | Mobile/desktop duplicate renderings do not expose hidden duplicate content to assistive technology |
| Color independence | Diff additions/removals retain `+`/`-` text markers; meaning is not color-only |
| Score semantics | Score bars expose accessible names/values while displayed numeric values remain API values |

## 9.6 Timing and Polling Test Matrix

All rows use fake timers.

| Behavior | Constant | Required boundary cases |
|---|---|---|
| Default API timeout | `REQUEST_TIMEOUT_DEFAULT_MS` | just before, exactly at, just after |
| Long API timeout | `REQUEST_TIMEOUT_LONG_MS` | just before, exactly at, just after |
| Checkout polling | `CHECKOUT_POLL_INTERVAL_MS`, `CHECKOUT_POLL_MAX_MS` | first poll, intermediate poll, exact max, after max |
| Submission fast polling | `SUBMISSION_POLL_FAST_MS` | first interval and repeated interval |
| Submission slow switch | `SUBMISSION_POLL_SLOW_AFTER_MS` | just before/exactly at/after switch |
| Submission stop | `SUBMISSION_POLL_STOP_AFTER_MS` | just before/exactly at/after stop |
| Verification resend | `RESEND_COOLDOWN_MS` | immediate repeat, exact expiry, after expiry |
| Ticket done sync | `TICKET_DONE_SYNC_INTERVAL_MS`, `TICKET_DONE_SYNC_MAX_ATTEMPTS` | 0/1/2/3 attempts and terminal state |
| Copy feedback | `COPY_FEEDBACK_MS` | exact announcement expiry |
| Mentor max chars | `MENTOR_MESSAGE_MAX_CHARS` | `null`, exact max, max+1 |

## 9.7 Query-Key and Cache Invalidation Matrix

| Query | Key | Must be used by | Invalidated/refetched by |
|---|---|---|---|
| Current user | `queryKeys.me` | `useMe` | auth mutations/session changes as specified |
| Subscription | `queryKeys.subscription` | `useSubscription` | 402 global handler, billing mutations |
| Payments | `queryKeys.payments` | `usePayments` | payment-related flow when specified |
| GitHub | `queryKeys.githubConnection` | `useGitHubConnection` | 403 global handler, connect/disconnect/create-repo as specified |
| Current ticket | `queryKeys.currentTicket` | `useCurrentTicket` | assign/abandon/submission reconciliation as specified |
| Ticket | `queryKeys.ticket(id)` | `useTicket` | ticket mutations and settlement sync |
| Mentor | `queryKeys.mentor(id)` | mentor hooks | mentor send/reconciliation |
| Submission | `queryKeys.submission(id, attempt, includeDiff)` | submission hook/card | submission/retry polling lifecycle |
| Profile | `queryKeys.profile` | `useExperienceProfile` | profile/evaluation completion as specified |

**Critical negative test:** no implementation may invalidate the bare `['ticket']` prefix, because the frontend specification explicitly forbids broad ticket invalidation.

## 9.8 Open Questions — Test Treatment

These remain unresolved and must not be converted into invented product requirements.

| ID | Test treatment |
|---|---|
| Q-04 | Test only the verification behavior explicitly specified; gate changes remain configuration/spec work |
| Q-08 | Keep permission wording in one component constant and assert the configured value |
| Q-10 / Q-10b / Q-10c | Use the configured mentor limit and the currently specified composer availability; do not invent a number or post-submit rule |
| Q-11 | Do not assert behavior not specified for existing sessions after password change |
| Q-12 | Do not test cookie SameSite/CSRF behavior in frontend unit tests; browser/backend integration owns it |
| Q-13 | Use configured submission polling/timeout constants; do not invent server timeout semantics |
| Q-14 | Assert that price is absent; do not invent a price |
| Q-15 | Assert no past-due action button; do not invent a new action |
| Q-16 | Test only the specified generic/typed OAuth error behavior; do not expose raw `access_denied` details |
| Q-17 | Assert mentor/feedback/diff are plain text; do not invent Markdown rendering |
| Q-18 | Keep support contact behavior isolated until specified |
| Q-20 | Assert full diff rendering and lazy opening as the interim behavior; do not add pagination/collapse |

## 9.9 Definition of Done

- [ ] Every test file named by frontend function-level spec 8 exists under `frontend/tests/`.
- [ ] Every named function/component/page has at least one direct contract test.
- [ ] API client has tests for envelope validation, timeout, abort, network failure, 401 refresh, refresh deduplication, replay, session-expiry guard, credentials and secret-safe behavior.
- [ ] Pure helpers have exhaustive state-table coverage.
- [ ] Query keys are exact and broad ticket invalidation is negatively tested.
- [ ] All auth pages cover validation, server errors, safe redirects and session states.
- [ ] Billing covers checkout, polling, cancellation, access expiry and no false-success behavior.
- [ ] GitHub covers OAuth result parsing, access gating, connection/reconnection and repo creation.
- [ ] Ticket phases cover every declared phase and missing/unknown runtime states.
- [ ] Mentor covers pending reconciliation, duplicate-send prevention and plain-text rendering.
- [ ] Submission polling covers fast/slow/stop/restart boundaries and attempt-1 score suppression.
- [ ] Score UI never calculates totals.
- [ ] Diff UI is text-only and handles CRLF, special lines and large diffs.
- [ ] Settings dirty-state navigation is covered.
- [ ] Route guards distinguish first-load 401 from session expiry.
- [ ] Integration tests cover the main end-to-end frontend flows without contacting external providers.
- [ ] Fake timers are used for every time-dependent test.
- [ ] Mutation retry is verified to be disabled.
- [ ] Accessibility checks cover focus, labels, live regions, keyboard interaction and hidden responsive duplicates.
- [ ] No V2/V3 UI, Django UI, Voxide UI, admin UI, MFA, localization, uploads or public-profile UI is introduced by tests.
- [ ] Unresolved Q-items remain visible and are not silently turned into assertions.

## 9.10 Traceability to Frontend Function-Level Specification

This plan is intentionally mapped to the frontend specification's source/test-file declarations. The frontend specification states that every function has a `Test file` and that those paths mirror the source path under `frontend/tests/`; this plan follows that contract. The source also explicitly requires frontend code to use cookie authentication via `credentials: 'include'`, keep server authoritative, avoid automatic mutation retries, and render API text as text, so those constraints are included as negative/security tests.

*Next: implementation should proceed test-first, then implementation, then integration/system verification against the frontend specification and the real existing template/code. Any contradiction with the real template must be recorded as an assumption/open question rather than silently resolved.*
