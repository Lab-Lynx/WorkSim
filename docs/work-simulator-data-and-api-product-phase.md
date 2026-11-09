# 14. Database and API Changes, Product Phase

Project: Work Simulator · Links back to: [13. Requirements and Use Cases](./work-simulator-requirements-product-phase.md), [12. Overview](./work-simulator-product-phase-overview.md)

New data rules are DR-12 to DR-24. New endpoints are EP-35 to EP-59. Decisions (D-P##), assumptions (A-##) and questions (Q-##) are in doc 12. All changes are additive. Nothing is dropped in this phase.

---

## 14.1 Summary of changes

| Area | Change | DR |
|---|---|---|
| Payment | Provider, method, reference, intent code, expiry, review fields. New statuses. `chapaTxRef` becomes optional. | DR-12 |
| Payment | One open intent per user | DR-13 |
| Payment | A reference can be claimed once while it is `succeeded` or `under_review` | DR-14 |
| Payment | New table `PaymentAttempt` | DR-15 |
| Admin | New table `AuditLog`, append only | DR-16 |
| Certificate | New table `Certificate` | DR-17 |
| Email | New table `EmailLog` | DR-18 |
| AI | New table `AiUsageLog` | DR-19 |
| Evaluation | `communicationBreakdown`, `model`, `promptVersion` | DR-20 |
| User | `disabledAt`, `disabledReason`, `termsAcceptedAt`, `termsVersion`, role check | DR-21 |
| Feedback | New table `FeedbackMessage` | DR-22 |
| Subscription | No column change. `renewalReminderSentAt` is reused (A-86). `chapaSubscriptionRef` stays optional. | DR-23 |
| Reports | Indexes for admin queries | DR-24 |

---

## 14.2 Prisma changes

```prisma
enum PaymentProvider {
  chapa
  manual_cbe
  manual_telebirr
}

// existing values stay: pending, succeeded, failed. Add three.
enum PaymentStatus {
  pending
  succeeded
  failed
  under_review
  rejected
  expired
}

enum PaymentAttemptOutcome {
  verified
  not_found
  amount_too_low
  wrong_receiver
  too_early
  already_claimed
  provider_unavailable
}

model Payment {
  // ... existing fields stay ...
  chapaTxRef    String?          @unique   // was required, now optional
  provider      PaymentProvider  @default(chapa)
  externalRef   String?          @db.VarChar(64)   // normalized bank or wallet reference
  intentCode    String?          @unique @db.VarChar(12)
  expiresAt     DateTime?
  verifiedAt    DateTime?
  payerName     String?          @db.VarChar(120)
  overpaidBy    Decimal?         @db.Decimal(12, 2)
  reviewedById  String?
  reviewedAt    DateTime?
  reviewNote    String?          @db.VarChar(500)
  attempts      PaymentAttempt[]

  @@index([status, createdAt])
  @@index([userId, createdAt])
}

model PaymentAttempt {
  id        String                @id @default(uuid())
  paymentId String
  payment   Payment               @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  userId    String
  reference String                @db.VarChar(64)
  outcome   PaymentAttemptOutcome
  createdAt DateTime              @default(now())

  @@index([userId, createdAt])
  @@index([paymentId])
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?
  action     String   @db.VarChar(60)    // for example payment.approve
  targetType String   @db.VarChar(40)
  targetId   String   @db.VarChar(64)
  note       String?  @db.VarChar(500)
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([targetType, targetId])
  @@index([createdAt])
}

model Certificate {
  id             String    @id @default(uuid())
  userId         String    @unique
  user           User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  publicId       String    @unique @db.VarChar(32)    // 16 random bytes, base64url
  displayName    String    @db.VarChar(80)
  issuedAt       DateTime  @default(now())
  taskCount      Int
  averageScore   Decimal   @db.Decimal(5, 2)
  rubricAverages Json      // { requirementsMet, correctnessTests, codeQuality, problemSolving }
  stacks         String[]
  concepts       String[]
  taskSummaries  Json      // [{ templateKey, title, tier, score }]
  policyVersion  Int       @default(1)
  revokedAt      DateTime?
  revokedReason  String?   @db.VarChar(500)
}

enum EmailType {
  verification
  password_reset
  payment_result
  renewal_reminder
  other
}

model EmailLog {
  id                String    @id @default(uuid())
  userId            String?
  type              EmailType
  provider          String    @db.VarChar(20)
  status            String    @db.VarChar(10)   // sent or failed
  providerMessageId String?   @db.VarChar(80)
  errorCode         String?   @db.VarChar(60)
  createdAt         DateTime  @default(now())

  @@index([createdAt])
  @@index([type, createdAt])
}

model AiUsageLog {
  id           String   @id @default(uuid())
  userId       String?
  ticketId     String?
  provider     String   @db.VarChar(20)    // gemini or groq
  purpose      String   @db.VarChar(40)    // ticket_generation, mentor, evaluation_feedback, evaluation_score
  model        String   @db.VarChar(60)
  inputTokens  Int?
  outputTokens Int?
  latencyMs    Int
  outcome      String   @db.VarChar(20)    // ok, timeout, rate_limited, malformed, error
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([provider, createdAt])
}

model FeedbackMessage {
  id        String   @id @default(uuid())
  userId    String?
  page      String?  @db.VarChar(120)
  message   String   @db.VarChar(2000)
  createdAt DateTime @default(now())

  @@index([createdAt])
}

model User {
  // ... existing fields stay ...
  disabledAt      DateTime?
  disabledReason  String?   @db.VarChar(500)
  termsAcceptedAt DateTime?
  termsVersion    String?   @db.VarChar(20)
}

model Evaluation {
  // ... existing fields stay ...
  communicationBreakdown Json?     // see 14.8, shape "Communication"
  model                  String?   @db.VarChar(60)
  promptVersion          String?   @db.VarChar(20)
}
```

Notes
- `User.role` stays a string. Allowed values are `user` and `admin` (DR-21, check constraint below).
- `Certificate.userId` uses `Restrict` like the tickets, so a user with a certificate cannot be deleted by accident.
- No receipt table yet. If FR-69 is built (Q-22), add `PaymentReceipt(id, paymentId, storageKey, mimeType, sizeBytes, createdAt, deleteAfter)` in a later migration.

---

## 14.3 SQL that Prisma cannot express (hand-written in the migration)

```sql
-- DR-13: one open manual intent per user
CREATE UNIQUE INDEX payment_one_open_intent_per_user
  ON "Payment" ("userId")
  WHERE "status" = 'pending' AND "provider" IN ('manual_cbe','manual_telebirr');

-- DR-14: a reference can be held by one live payment at a time
CREATE UNIQUE INDEX payment_reference_claimed_once
  ON "Payment" ("provider", "externalRef")
  WHERE "externalRef" IS NOT NULL AND "status" IN ('succeeded','under_review');

-- DR-21: role values
ALTER TABLE "User" ADD CONSTRAINT user_role_allowed CHECK ("role" IN ('user','admin'));

-- DR-12: a manual payment must carry its intent code and expiry
ALTER TABLE "Payment" ADD CONSTRAINT payment_manual_needs_intent
  CHECK ("provider" = 'chapa' OR ("intentCode" IS NOT NULL AND "expiresAt" IS NOT NULL));
```

Rejected and expired payments release their reference, because the partial index only covers `succeeded` and `under_review`.

---

## 14.4 Migration plan

1. **Migration A (enums only).** Add the three `PaymentStatus` values and the new enums in their own migration. A new enum value cannot be used in the same transaction that adds it.
2. **Migration B (tables and columns).** Make `chapaTxRef` optional. Add all new columns and tables. Add indexes.
3. **Migration C (hand-written SQL)** from 14.3. Check the SQL file is committed before merging.
4. **Backfill.** None needed. Existing payments get `provider = chapa`. Existing users have `termsAcceptedAt = null` and are asked to accept on next login (the UI shows a one-time prompt).
5. **Existing users and verification.** Not auto-verified (A-99).
6. **Order of deploy.** Run migrations first (the Render build already runs `prisma migrate deploy`). The old code keeps working because nothing was removed.
7. **Rollback.** Code rollback is safe. Migrations are not rolled back. A bad migration is fixed forward.
8. **Code that must change with Migration B.** Anything that reads `chapaTxRef` as required, switch statements over `PaymentStatus`, the payment serializer, and the test factories.

---

## 14.5 Settings (environment variables)

| Name | Example | Secret | Used for |
|---|---|---|---|
| `PASS_PRICE_ETB` | `450` | no | Pass price (A-85) |
| `PASS_DURATION_DAYS` | `30` | no | Pass length |
| `PAYMENT_INTENT_TTL_HOURS` | `48` | no | Intent expiry (A-81) |
| `PAYMENT_VERIFY_MAX_PER_HOUR` | `5` | no | Attempt limit (A-82) |
| `PAYMENT_VERIFY_MAX_PER_DAY` | `20` | no | Attempt limit |
| `PAYMENT_CBE_ACCOUNT_NUMBER` | `1000...` | no (shown to payers) | Receiver for CBE |
| `PAYMENT_CBE_ACCOUNT_NAME` | name | no | Shown to payers |
| `PAYMENT_TELEBIRR_NUMBER` | `09...` | no (shown to payers) | Receiver for Telebirr |
| `PAYMENT_TELEBIRR_NAME` | name | no | Shown to payers |
| `VERIFY_ET_API_KEY` | key | **yes** | Verify.ET calls |
| `VERIFY_ET_BASE_URL` | URL | no | Verify.ET host |
| `VERIFY_ET_TIMEOUT_MS` | `8000` | no | Provider timeout |
| `PAYMENT_CHAPA_ENABLED` | `false` | no | FR-73 |
| `EMAIL_PROVIDER` | `mailjet` | no | A-93 |
| `MAILJET_API_KEY` | key | **yes** | Mailjet |
| `MAILJET_API_SECRET` | secret | **yes** | Mailjet |
| `EMAIL_FROM_ADDRESS` | `no-reply@your-domain` | no | Sender. Must be a verified Mailjet sender on a domain the team controls. |
| `EMAIL_FROM_NAME` | `WorkSim` | no | Sender name |
| `EMAIL_DAILY_SOFT_LIMIT` | `180` | no | FR-59 |
| `RENEWAL_REMINDER_DAYS` | `7` | no | FR-72 |
| `JOB_SECRET` | random | **yes** | Protects EP-56 |
| `CERT_MIN_TASKS` | `5` | no | FR-90 |
| `CERT_MIN_AVERAGE` | `60` | no | FR-90 |
| `ADMIN_METRICS_CACHE_SECONDS` | `15` | no | A-88 |
| `SUPPORT_EMAIL` | address | no | FR-104 |
| `TERMS_VERSION` | `2026-11-01` | no | Stored on register |

Removed: every `GUEST_*` setting. Rotate the guest account password before deleting the account.

---

## 14.6 Conventions added

**Error code.** The error envelope may carry a string `code` (D-P17, A-102):
`{ statusCode, success: false, message, data: null, code: "EMAIL_NOT_VERIFIED" }`. The frontend uses `code` first and falls back to status and message for older endpoints.

New codes: `EMAIL_NOT_VERIFIED` (403), `ACCOUNT_DISABLED` (403), `ADMIN_ONLY` (403), `INTENT_EXPIRED` (409), `INTENT_NOT_OPEN` (409), `REFERENCE_ALREADY_USED` (409), `INVALID_REFERENCE_FORMAT` (400), `TOO_MANY_ATTEMPTS` (429), `NOT_ELIGIBLE` (409), `ALREADY_CERTIFIED` (409), `ALREADY_DECIDED` (409), `PROVIDER_DISABLED` (404).

**New status code.** 422 means the request was well formed but the payment could not be matched (EP-37). The message says why, in plain words. Other codes keep their meaning from doc 5.

**New access levels**

| Level | Meaning | Failure |
|---|---|---|
| + Verified | `emailVerifiedAt` is set | 403 `EMAIL_NOT_VERIFIED` |
| Admin | role is `admin` and the account is not disabled | 403 `ADMIN_ONLY` |
| Job | header `x-job-secret` equals `JOB_SECRET` | 401 |

**Rate limits for new routes.** Payment verify: per user 5 per hour and 20 per day (stored attempts), plus 30 per hour per IP. Intent create: 10 per hour per user. Admin: 120 per minute per admin. Public certificate: 60 per minute per IP. Feedback: 10 per hour per user. Resend verification: FR-58.

All write routes keep the CSRF origin check.

---

## 14.7 Endpoint table

| EP | Method | Path | Access | UC | FR |
|---|---|---|---|---|---|
| EP-35 | GET | /payments/info | Required | UC-30, UC-34 | FR-61, FR-62 |
| EP-36 | POST | /payments/intents | Required + Verified | UC-30 | FR-63 |
| EP-37 | POST | /payments/intents/:intentId/verify | Required + Verified | UC-31 | FR-64 to FR-68 |
| EP-38 | GET | /payments/intents/current | Required | UC-30, UC-31 | FR-63 |
| EP-39 | POST | /payments/intents/:intentId/receipt | Required + Verified | UC-31 | FR-69 (Could) |
| EP-40 | GET | /admin/overview | Admin | UC-35 | FR-79, FR-59, FR-80 |
| EP-41 | GET | /admin/payments | Admin | UC-32 | FR-70 |
| EP-42 | GET | /admin/payments/:paymentId | Admin | UC-32 | FR-70 |
| EP-43 | POST | /admin/payments/:paymentId/approve | Admin | UC-32 | FR-70, FR-76 |
| EP-44 | POST | /admin/payments/:paymentId/reject | Admin | UC-32 | FR-70, FR-76 |
| EP-45 | GET | /admin/users | Admin | UC-36 | FR-77 |
| EP-46 | GET | /admin/users/:userId | Admin | UC-36 | FR-77 |
| EP-47 | POST | /admin/users/:userId/disable | Admin | UC-36 | FR-78, FR-76 |
| EP-48 | POST | /admin/users/:userId/enable | Admin | UC-36 | FR-78, FR-76 |
| EP-49 | POST | /admin/certificates/:certificateId/revoke | Admin | UC-37 | FR-78, FR-95, FR-76 |
| EP-50 | GET | /admin/audit-log | Admin | UC-35 | FR-76 |
| EP-51 | GET | /certificates/eligibility | Required | UC-42 | FR-90, FR-91 |
| EP-52 | POST | /certificates | Required + Verified | UC-43 | FR-92, FR-96 |
| EP-53 | GET | /certificates/me | Required | UC-42, UC-43 | FR-92, FR-94 |
| EP-54 | GET | /public/certificates/:publicId | Public | UC-44 | FR-93, FR-95 |
| EP-55 | POST | /feedback | Required | UC-48 | FR-106 |
| EP-56 | POST | /internal/jobs/renewal-reminders | Job | UC-33 | FR-72 |
| EP-57 | GET | /admin/feedback | Admin | UC-48 | FR-106 |
| EP-58 | POST | /internal/jobs/cleanup | Job | none | NFR data retention |
| EP-59 | POST | /users/me/accept-terms | Required | UC-28 | FR-107 |

---

## 14.8 Endpoint detail

Base path `/api/v1`. Envelope as in doc 5. IDs are UUIDs. Money is a string with two decimals.

### Shared objects (additions)

**PaymentIntent**
```json
{
  "id": "uuid",
  "code": "WS-7K2M9Q",
  "method": "cbe | telebirr",
  "amount": "450.00",
  "currency": "ETB",
  "status": "pending | under_review | succeeded | rejected | expired",
  "expiresAt": "timestamp",
  "payee": { "name": "string", "account": "string" }
}
```
`payee.account` is the CBE account number or the Telebirr phone number.

**Payment** (extends doc 5): add `provider` (`chapa | manual_cbe | manual_telebirr`) and the new statuses.

**Communication**
```json
{
  "mentorQuestions": 72,
  "prAndCommits": 55,
  "responseToFeedback": null,
  "tips": ["Say what you already tried before you ask.", "Add a sentence on why you made the change."]
}
```
`responseToFeedback` is `null` after the first review. Numbers are 0 to 100. Evaluation objects in the submission endpoints gain `communication`.

### EP-35 GET /payments/info
Returns `{ price, currency, durationDays, freeTicketsTotal, freeTicketsUsed, methods: [{ method, enabled, payee }], supportEmail, activePassEndsAt }`. A method is `enabled` only if its settings are filled. No errors besides 401.

### EP-36 POST /payments/intents
Body `{ method: "cbe" | "telebirr" }`. Returns 201 with a **PaymentIntent**, or 200 with the same intent if one is open for that method (A-83). If an open intent has another method, it is marked `expired` and a new one is created. Errors: 400 invalid method, 403 `EMAIL_NOT_VERIFIED`, 404 `PROVIDER_DISABLED` (method not configured), 429.

### EP-37 POST /payments/intents/:intentId/verify
Body `{ reference: string }`. The server trims, uppercases and removes spaces. Valid format: 6 to 40 letters and digits.

Order of checks
1. Intent exists and belongs to the caller (else 404).
2. Status is `pending` (else 409 `INTENT_NOT_OPEN`). Not past `expiresAt` (else the intent becomes `expired` and the answer is 409 `INTENT_EXPIRED`).
3. Format (else 400 `INVALID_REFERENCE_FORMAT`, not counted).
4. Attempt limit (else 429 `TOO_MANY_ATTEMPTS`, with seconds to wait in `message`).
5. Reference not held by another live payment (else 409 `REFERENCE_ALREADY_USED`, attempt `already_claimed`).
6. Call the verifier with an 8 second timeout.
7. Map the result.

| Verifier result | Response | Payment status | Attempt outcome |
|---|---|---|---|
| verified | 200 `{ payment, subscription }` | `succeeded` | `verified` |
| not_found | 422 `{ message: "We could not find this payment" }` | stays `pending` | `not_found` |
| amount_too_low | 422 with found amount in the message | `pending` | `amount_too_low` |
| wrong_receiver | 422 | `pending` | `wrong_receiver` |
| too_early | 422 | `pending` | `too_early` |
| provider_unavailable | 202 `{ payment }` | `under_review`, reference saved | `provider_unavailable` |

When verified, in one database transaction: save `externalRef`, `verifiedAt`, `payerName`, `overpaidBy`; set `succeeded`; create the `Subscription` or extend `currentPeriodEnd` by the pass length from the later of now and the current end; set `renewalReminderSentAt` to null. A unique-index conflict (two people claim at once) returns 409 `REFERENCE_ALREADY_USED`. The confirmation email is sent after the commit.

### EP-38 GET /payments/intents/current
Returns the open **PaymentIntent** or `null`. If the intent has passed its expiry, it is set to `expired` and `null` is returned.

### EP-39 POST /payments/intents/:intentId/receipt (Could)
Multipart with one image. Only for a payment in `under_review`. Type is checked by content. Max 5 MB. 201 `{ received: true }`. Not built until Q-22 is answered.

### EP-40 GET /admin/overview?from=&to=
Default range: the last 30 days. Cached for 15 seconds.
```json
{
  "range": { "from": "timestamp", "to": "timestamp" },
  "funnel": { "registered": 0, "verified": 0, "githubConnected": 0, "repoCreated": 0, "firstTicket": 0, "firstScore": 0, "paid": 0, "certified": 0 },
  "dailySignups": [{ "date": "2026-11-01", "count": 0 }],
  "passes": { "active": 0, "endingIn7Days": 0 },
  "revenue": { "currency": "ETB", "total": "0.00", "byDay": [{ "date": "2026-11-01", "amount": "0.00" }] },
  "submissions": { "byStatus": { }, "processingOver15Min": 0 },
  "failureRates": { "evaluation": 0.0, "ci": 0.0, "paymentVerification": 0.0 },
  "email": { "sentToday": 0, "failedToday": 0, "softLimit": 180 },
  "ai": { "byProviderDay": [{ "date": "2026-11-01", "provider": "gemini", "calls": 0, "failures": 0, "inputTokens": 0, "outputTokens": 0 }] },
  "generatedAt": "timestamp"
}
```
**Funnel definition.** Take the users who registered in the range. Each stage counts how many of them have: a verified email; a GitHub connection; a starter repo; at least one ticket; at least one final score; at least one succeeded payment; a certificate. Each metric card can fail on its own (UC-35 alternate).

### EP-41 GET /admin/payments?status=under_review&cursor=&limit=
Cursor list, newest first, limit up to 50. Items: id, user (id, name, email), provider, amount, status, reference (full), createdAt.

### EP-42 GET /admin/payments/:paymentId
The payment, the user summary, all `PaymentAttempt` rows, the review fields. 404 if missing.

### EP-43 POST /admin/payments/:paymentId/approve
Body `{ note?: string }`. Only from `under_review`, else 409 `ALREADY_DECIDED`. Starts or extends the pass like EP-37. Sends an email. Writes an audit row `payment.approve`.

### EP-44 POST /admin/payments/:paymentId/reject
Body `{ reason: string }` (required, 5 to 500). Only from `under_review`. Releases the reference. Sends an email. Audit row `payment.reject`.

### EP-45 GET /admin/users?q=&cursor=&limit=
Search by email or name (case-insensitive contains). Items: id, name, email, verified, role, disabled, passEndsAt, ticketCounts, certificate yes or no.

### EP-46 GET /admin/users/:userId
Summary: the fields above plus average score, tickets list (id, template key, tier, status, final score), payments, certificate. No tokens, no hashes.

### EP-47 and EP-48 POST /admin/users/:userId/disable and /enable
Disable body `{ reason }`. Admin cannot disable themselves (400). Disable also revokes the user's refresh tokens. Audit rows `user.disable` and `user.enable`.

### EP-49 POST /admin/certificates/:certificateId/revoke
Body `{ reason }`. 409 `ALREADY_DECIDED` if already revoked. Audit row `certificate.revoke`.

### EP-50 GET /admin/audit-log?cursor=&limit=&action=
Newest first. Items: id, actor (id, name), action, targetType, targetId, note, createdAt.

### EP-51 GET /certificates/eligibility
```json
{
  "eligible": false,
  "tasksDone": 4,
  "tasksRequired": 5,
  "average": "63.50",
  "averageRequired": "60.00",
  "missing": ["1 more task"],
  "certificate": null
}
```
`missing` holds plain sentences for the UI. `certificate` holds the public ID and status if one exists.

### EP-52 POST /certificates
Body `{ displayName: string }` (2 to 80 characters, trimmed, no line breaks). Re-checks eligibility inside a transaction. 201 with the certificate: `{ publicId, displayName, issuedAt, url }`. Errors: 403 `EMAIL_NOT_VERIFIED`, 409 `NOT_ELIGIBLE`, 409 `ALREADY_CERTIFIED`.

### EP-53 GET /certificates/me
The caller's certificate or `null`, with the same fields as the public view plus `url`.

### EP-54 GET /public/certificates/:publicId
No login. 
```json
{
  "status": "valid | revoked",
  "displayName": "string",
  "issuedAt": "timestamp",
  "revokedAt": "timestamp | null",
  "taskCount": 5,
  "averageScore": "72.40",
  "rubricAverages": { "requirementsMet": 70, "correctnessTests": 75, "codeQuality": 70, "problemSolving": 74 },
  "stacks": ["react"],
  "concepts": ["state management", "forms and validation"],
  "tasks": [{ "title": "string", "tier": 2, "score": 78 }],
  "disclaimer": "WorkSim certificates record completed practice work, scored by an AI evaluator against a fixed rubric. They are not a professional qualification and are not verified by any employer."
}
```
404 for unknown IDs. The response never includes email, user ID or repository links. Add `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

### EP-55 POST /feedback
Body `{ message: string, page?: string }` (message 1 to 2000). 201 `{ received: true }`.

### EP-56 POST /internal/jobs/renewal-reminders
Header `x-job-secret`. Finds users whose pass ends within `RENEWAL_REMINDER_DAYS` days, have `renewalReminderSentAt` null, and whose `currentPeriodEnd` is in the future. Sends one email each, then sets `renewalReminderSentAt`. Returns `{ sent, skipped, failed }`. Safe to call twice (A-86). Scheduler: Q-26.

### EP-57 GET /admin/feedback?cursor=&limit=
Newest first. Items: id, user (id, email or null), page, message, createdAt.

### EP-58 POST /internal/jobs/cleanup
Header `x-job-secret`. Deletes rows older than the retention periods in 14.12 and returns `{ deleted: { paymentAttempts, emailLogs, aiUsageLogs, tokens } }`. Safe to run twice.

### EP-59 POST /users/me/accept-terms
Body `{ version: string }`. The version must equal `TERMS_VERSION`, else 400. Stores `termsAcceptedAt` (now) and `termsVersion`. Returns the user object. Used by the prompt for existing users and by the register flow's checkbox when the client sends it separately.

---

## 14.9 Changes to existing endpoints

| Endpoint | Change |
|---|---|
| EP-01 register | Body adds `acceptTerms: true` (required). Stores `termsAcceptedAt` and `termsVersion`. It still signs the user in. |
| EP-02 login | A disabled user gets 403 `ACCOUNT_DISABLED`. |
| `GET /auth/guest`, `POST /auth/guest` | Removed (404). |
| EP-23 assign ticket | Adds the verified gate (403 `EMAIL_NOT_VERIFIED`). Uses the selection rule in doc 15. The ticket object adds `tier`, `concepts` and `whyItMatters`. |
| EP-13, EP-14, EP-16 (Chapa) | When `PAYMENT_CHAPA_ENABLED=false` they return 404 `PROVIDER_DISABLED`. |
| EP-17 GET /payments | Returns the new `provider` and statuses. |
| Submission endpoints that return an evaluation | Add the `communication` object (14.8). |
| EP-28 mentor | The mentor stays available during `submitted_v1` (earlier decision D-04, FR-37). |

---

## 14.10 Verify.ET adapter contract (inside our code)

The rest of the code talks to this interface, never to Verify.ET directly. This also lets tests use a fake.

```ts
type ManualMethod = 'cbe' | 'telebirr';

interface VerifyInput {
  method: ManualMethod;
  reference: string;               // normalized
  expected: {
    minAmount: string;             // "450.00"
    receiver: { account?: string; phone?: string; name?: string };
    notBefore: Date;               // intent creation time
  };
}

type VerifyResult =
  | { outcome: 'verified'; amount: string; paidAt: Date; payerName?: string }
  | { outcome: 'not_found' }
  | { outcome: 'amount_too_low'; foundAmount: string }
  | { outcome: 'wrong_receiver' }
  | { outcome: 'too_early'; paidAt: Date }
  | { outcome: 'provider_unavailable' };

interface ManualPaymentVerifier {
  verify(input: VerifyInput): Promise<VerifyResult>;
}
```

The mapping from Verify.ET's own request and response to this interface is **not specified here** because we have not read their reference yet (Q-21, A-79). The adapter must: send the API key from settings; send an idempotency key per attempt if they support one; pass the account suffix that CBE checks need; apply the 8 second timeout; map network errors, timeouts and 5xx to `provider_unavailable`; never log full references (last 4 only).

---

## 14.11 Payment state machine

```
pending ──(verify ok)──────────────► succeeded
pending ──(provider down)──────────► under_review ──(admin approve)──► succeeded
                                                  └─(admin reject)───► rejected
pending ──(48h pass)───────────────► expired
```

Rules: `succeeded`, `rejected`, `expired` are final. Chapa payments keep their old path (`pending`, `succeeded`, `failed`). A daily cleanup also marks old `pending` manual intents as `expired`.

---

## 14.12 Data retention jobs

| Data | Keep | Job |
|---|---|---|
| `PaymentAttempt` | 12 months | daily cleanup |
| `EmailLog` | 90 days | daily cleanup |
| `AiUsageLog` | 180 days | daily cleanup |
| `AuditLog` | kept | none |
| Expired and revoked tokens | 7 days after expiry | daily cleanup (closes an item from the security checklist) |

The cleanup runs through EP-58 `POST /internal/jobs/cleanup`, with the same secret and the same scheduler as EP-56. It is safe to run twice. It is a sub-issue of WP-05.

---

Next: proceed to → [15. Ticket Templates, Rubric and Certificate Policy](./work-simulator-ticket-templates-rubric-certificates.md)
