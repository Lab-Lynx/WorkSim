# 13. Requirements and Use Cases, Product Phase

Project: Work Simulator · Links back to: [12. Overview](./work-simulator-product-phase-overview.md)

New requirements are FR-54 to FR-107. New use cases are UC-28 to UC-49. Decisions are D-P## and assumptions are A-## from doc 12. Each requirement must be testable. If you cannot write a test for it, make it more specific.

Priority: Must, Should, Could.

---

## 13.1 Functional requirements

### 13.1.1 Guest removal

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-54 | The login and register pages have no "Continue as guest" option. `GET /auth/guest` and `POST /auth/guest` return 404. The settings for the demo account are removed. | Must | UC-28 |
| FR-55 | The existing guest account and its data are removed by a script. The script runs in dry-run mode by default and needs a flag to delete. | Must | UC-28 |

### 13.1.2 Email and verification

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-56 | All transactional email (verification, password reset, payment result, renewal reminder) is sent through the configured provider. Mailjet is the default (D-P05, A-93). | Must | UC-29 |
| FR-57 | A user with no verified email gets 403 with code `EMAIL_NOT_VERIFIED` when they try to get a ticket (EP-23), create a payment intent (EP-36), verify a payment (EP-37) or claim a certificate (EP-52). Other pages stay open. | Must | UC-29 |
| FR-58 | A user can ask for a new verification email. There is a 60 second wait between requests and a limit of 5 per day. | Must | UC-29 |
| FR-59 | Each email attempt is recorded (type, provider, status). The admin overview shows today's count and a warning when it reaches 180. A failed send never blocks registration. | Should | UC-29, UC-35 |
| FR-60 | An unverified user sees a banner on every page with a "Resend email" button. Buttons that need verification explain why they are disabled. | Must | UC-29 |

### 13.1.3 Payments (pass)

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-61 | A pass costs the price in `PASS_PRICE_ETB` (450) for `PASS_DURATION_DAYS` (30). The first 3 tickets stay free. | Must | UC-30 |
| FR-62 | The billing page shows the price, the pass length, how many free tickets are left, the CBE and Telebirr receiving accounts from settings, and the steps to pay. | Must | UC-30, UC-34 |
| FR-63 | A verified user can create a payment intent by choosing CBE or Telebirr. The intent has a code like `WS-7K2M9Q`, an amount, and an expiry 48 hours later (A-81). A user has one open intent (A-83). | Must | UC-30 |
| FR-64 | A user submits the bank or wallet transaction reference for their open intent. The server checks it with Verify.ET: the payment exists, was successful, the amount is at least the price, the receiver is the configured account, and the transaction time is not before the intent was created. | Must | UC-31 |
| FR-65 | A transaction reference can be claimed once only for a given method. A second claim returns 409 with code `REFERENCE_ALREADY_USED`. | Must | UC-31 |
| FR-66 | When verification succeeds, the payment becomes `succeeded`, the pass starts or is extended (A-84), a confirmation email is sent, and the billing page shows the new end date. All of this happens in one database transaction, except the email. | Must | UC-31 |
| FR-67 | Verification attempts are limited (A-82). Every attempt is stored with its outcome. Over the limit returns 429. | Must | UC-31 |
| FR-68 | If Verify.ET is unavailable or times out, the payment moves to `under_review`, the user sees a clear message, and the admin queue shows it. A user is never asked to pay twice because of our failure. | Must | UC-31, UC-32 |
| FR-69 | A user can upload a receipt image for a payment that is under review. Allowed: JPEG, PNG, WebP, up to 5 MB. Files are stored privately and deleted 30 days after the decision. Depends on Q-22. | Could | UC-31 |
| FR-70 | An admin can approve or reject a payment under review. A reason is required for rejection. The user gets an email. The action is written to the audit log. Approving starts the pass like FR-66. | Must | UC-32 |
| FR-71 | A user can list their payments with date, method, amount and status (extends FR-23). | Must | UC-34 |
| FR-72 | A scheduled job sends a reminder email to users whose pass ends in 7 days, once per pass period (A-86). Running the job twice never sends two emails. | Should | UC-33 |
| FR-73 | Chapa checkout code stays behind a payment provider interface and is switched off by `PAYMENT_CHAPA_ENABLED=false` (A-101). The UI never shows it while it is off. | Should | none |
| FR-74 | When a pass ends, access ends at `currentPeriodEnd`. The dashboard shows a "Renew" button. Tickets, history and the certificate stay visible. | Must | UC-33 |

### 13.1.4 Admin and analytics

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-75 | Admin routes and pages are only for users with role `admin`. Others get 403. The role is granted by a script (A-87). | Must | UC-35 |
| FR-76 | Every admin write action is stored in an audit log: who, what, which record, when, and a short note. Audit rows are never edited or deleted by the app. | Must | UC-35, UC-32 |
| FR-77 | An admin can search users by email or name and open a user page: verified or not, pass end date, ticket counts, average score, payments, certificate. | Must | UC-36 |
| FR-78 | An admin can disable and enable a user (a disabled user cannot log in), and can revoke a certificate. A reason is required and audited. | Should | UC-36, UC-37 |
| FR-79 | The admin overview shows, for a date range: the funnel (registered, verified, GitHub connected, repo created, first ticket, first score, paid, certified), daily signups, active passes, revenue, submissions by status, stuck submissions, failure rates, emails today, and AI calls by provider. It refreshes every 30 seconds (A-88). | Must | UC-35 |
| FR-80 | Every Gemini and Groq call is logged with purpose, provider, model, token counts if known, time taken and outcome. The overview shows estimated usage per day. | Should | UC-35 |

### 13.1.5 Tickets, rubric and communication

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-81 | Ticket templates use schema v2 (doc 15): stack, topic category, concepts, tier, scenario domains, what the starter must contain, optional ambiguity, version. | Must | UC-38 |
| FR-82 | The library has at least 6 templates per stack, with 2 per tier, covering the concept ladders (A-97). | Must | UC-38 |
| FR-83 | Ticket selection follows the rule in doc 15 section 15.4: tier by ticket number, no repeats, scenario rotation, same result for the same inputs. | Must | UC-38 |
| FR-84 | A ticket shows its tier, the concepts it practices, and one line on why they matter at work. | Should | UC-38 |
| FR-85 | Some Tier 2 and Tier 3 tickets have one deliberate gap in the requirements. The mentor treats a clarifying question about it as a good question and answers it within the hint rules. | Should | UC-39 |
| FR-86 | The evaluator receives the PR title and description, the commit messages and the mentor transcript. It treats all of this as untrusted text (doc 15 section 15.6). | Must | UC-40 |
| FR-87 | Each evaluation stores three communication sub-scores (mentor questions, PR and commit writing, response to feedback) and at most 3 short tips. The three sub-scores make up the 15% category (A-96). | Must | UC-40 |
| FR-88 | The ticket page shows the communication feedback after the first review and after the final review. | Must | UC-40 |
| FR-89 | A workplace communication guide is available in the app: asking for help, writing a PR description, writing commit messages, responding to review comments. Each has a short good and weak example. | Should | UC-41 |

### 13.1.6 Certificates

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-90 | A user is eligible when they have at least 5 tickets in status `done` with a final score, the average of all those scores is at least 60.00, the email is verified, and the account is not disabled (A-90, D-P11). | Must | UC-42 |
| FR-91 | The certificate page shows progress: tasks done out of 5, current average, and what is missing. | Must | UC-42 |
| FR-92 | An eligible user claims the certificate by confirming a display name (2 to 80 characters). The system stores a snapshot and an unguessable public ID (A-89). | Must | UC-43 |
| FR-93 | Anyone can open `/verify/:publicId` without logging in. The page shows valid or revoked, name, issue date, task count, average, the four rubric averages, concepts practiced, stacks used, and the disclaimer (A-91, A-103). It shows no email and no repository links. | Must | UC-44 |
| FR-94 | The user can copy the link, print the certificate page to PDF, and use an "Add to LinkedIn" link. | Should | UC-43 |
| FR-95 | A revoked certificate stays at its address and shows "Revoked" with the date. | Should | UC-37, UC-44 |
| FR-96 | One certificate per user. Only an admin can re-issue. | Must | UC-43 |

### 13.1.7 Landing, guides and legal

| ID | Requirement | Priority | UC |
|---|---|---|---|
| FR-97 | The landing page has: hero, how it works, concepts you practice, a real ticket preview, pricing, certificate, user stories, testimonials, FAQ, footer. | Must | UC-45 |
| FR-98 | Landing text comes from one typed content file, not from the database (A-92). | Must | UC-45 |
| FR-99 | Testimonials appear in the exact words given, with the person's name and role, and only with written permission (A-104, Q-23). | Must | UC-45 |
| FR-100 | The app explains pull requests, branches, commits, automated tests, CI/CD and code review in plain language, at the place where each appears (ticket page, submission page) and on a "How it works" page. | Must | UC-46 |
| FR-101 | A first-run checklist guides a new user: verify email, connect GitHub, pick a stack, get the first ticket. It hides when complete. | Should | UC-47 |
| FR-102 | A short video guide is embedded on the landing page and the checklist. | Could | UC-49 |
| FR-103 | Terms, Privacy and Refund pages exist and are linked in the footer. Registration needs a checkbox that accepts Terms and Privacy. | Must | UC-45, UC-28 |
| FR-104 | A support email address is visible on the landing page, the footer and the billing page. | Must | UC-45 |
| FR-105 | Landing page visits are measured with a privacy-friendly tool, if one is chosen (Q-25). | Could | none |
| FR-106 | A logged-in user can send feedback from any page. The message is stored with the page name and the user ID, and an admin can read it. | Could | UC-48 |
| FR-107 | A signed-in user who has not accepted the current Terms version sees a prompt and cannot continue until they accept or log out. Accepting stores the time and the version (EP-59). | Must | UC-28 |

---

## 13.2 Non-functional requirements (additions)

| Category | Requirement | How it is verified |
|---|---|---|
| Performance | `POST /payments/intents/:id/verify` answers within 10 seconds at p95, including the provider call. The provider call times out at 8 seconds. | Timing in tests with a slow mock |
| Performance | Admin overview answers within 2 seconds at p95 for a 30-day range. The public certificate page answers within 1 second at p95. | Load check |
| Performance | Landing page: Largest Contentful Paint under 2.5 seconds on a mid-range phone over 4G. | Lighthouse |
| Security | Verification endpoints use per-user and per-IP limits. Reference numbers are shown in logs as the last 4 characters only. | Code review, log check |
| Security | Admin routes check the role on the server on every request. Hidden menu items are not protection. | RBAC tests (doc 17) |
| Security | The certificate public ID has at least 128 bits of randomness. | Unit test |
| Security | Text from a PR (title, description, commit messages) is never trusted by the evaluator (FR-86). | Injection tests |
| Security | If receipt upload is built: file type checked by content, size limit, images re-encoded, private storage, short-lived links, no public URL. | Review and tests |
| Privacy | Student code, chat and PR text are sent to Gemini and Groq. This is stated in the Privacy page. Research recordings need written consent. | Document review |
| Reliability | Scheduled jobs are safe to run twice. A Verify.ET or Mailjet outage never loses a payment or blocks registration. | Tests with failing mocks |
| Observability | Payment events, admin actions, email results and AI calls are logged distinctly, with request IDs. | Code review |
| Accessibility | Landing, auth, billing, ticket, certificate and admin pages meet WCAG 2.1 AA as a target: keyboard use, contrast, focus, labels, reduced motion. Not a release blocker, but each failure is listed. | axe checks, manual pass |
| Compatibility | Latest two versions of Chrome, Edge, Firefox and Safari. Layouts work from 320 px wide. | Manual pass |
| Data retention | Payment attempts: 12 months. Audit log: kept. Email log: 90 days. AI usage log: 180 days. Receipt images: 30 days after decision. | Cleanup job tests |
| Language | English in this phase. Texts are kept in content files so Amharic can be added later. | Review |

---

## 13.3 Out of scope for this phase

- Automatic recurring billing, refunds in the app, coupons, invoices as PDF.
- A CMS or inline text editing in production.
- Public profiles, leaderboards, employer accounts.
- Server-generated certificate PDFs and image cards for sharing.
- Payment by voice.
- Granting admin from the UI.
- Amharic translation.

---

## 13.4 Existing requirements that change

| Requirement | Change |
|---|---|
| FR-15 | The gate is "3 free tickets, then a paid pass" at ticket assignment. It does not gate every action. |
| FR-16 to FR-22 | Chapa checkout and renewals are replaced in the UI by FR-61 to FR-74. The Chapa code stays, disabled (FR-73). |
| FR-23 | Extended by FR-71 (method and new statuses). |
| FR-37 | The mentor stays available during `submitted_v1`. |
| FR-46 | The 15% category now has three sub-scores (FR-87). |
| FR-50, FR-51 | The profile page also shows certificate progress (FR-91). |

---

## 13.5 Use cases

### UC-28: Sign in or register without a guest option
- **Actor:** visitor
- **Precondition:** none
- **Trigger:** opens the login or register page
- **Linked FR:** FR-54, FR-55, FR-103, FR-107
- **Main flow:** 1. The page shows email and password only. 2. On the register page the visitor ticks "I accept the Terms and Privacy Policy". 3. The account is created and the user is signed in. 4. A banner asks them to verify their email.
- **Alternate:** Typing the old guest address in the browser, or calling the old guest endpoint, returns 404. Registering without ticking the box shows a field error. An existing user who has not accepted the current Terms sees a prompt after login and must accept to continue (FR-107).
- **Postcondition:** the user has a normal account.

### UC-29: Verify email and resend
- **Actor:** registered user
- **Precondition:** email not verified
- **Trigger:** clicks the link in the email, or "Resend email"
- **Linked FR:** FR-56 to FR-60, FR-57
- **Main flow:** 1. User opens the link. 2. The server marks the email verified. 3. The banner disappears and gated buttons turn on.
- **Alternate:** The link was already used: show "already verified" (as UC-02). The link expired: offer resend. Resend inside 60 seconds: show the remaining wait. Over 5 per day: show a message and the support email. Email provider failed: the user sees "We could not send the email, try again later". The failure is logged.
- **Postcondition:** `emailVerifiedAt` is set.

### UC-30: Start a payment intent
- **Actor:** verified user
- **Precondition:** no active pass, or the user wants to extend
- **Trigger:** chooses CBE or Telebirr on the billing page
- **Linked FR:** FR-61 to FR-63
- **Main flow:** 1. The page shows price, steps and the payee details. 2. User chooses a method. 3. The system creates an intent with a code and a 48 hour expiry. 4. The page shows the amount, the payee account, the code and the countdown.
- **Alternate:** Unverified email: 403 and the banner. An open intent with the same method already exists: it is shown again. An open intent with another method exists: it is replaced and the user is told.
- **Postcondition:** one open intent exists.

### UC-31: Submit a transaction reference
- **Actor:** verified user with an open intent
- **Precondition:** the user paid outside the app
- **Trigger:** enters the reference and presses "Verify payment"
- **Linked FR:** FR-64 to FR-69, FR-74
- **Main flow:** 1. The server checks the format and the attempt limit. 2. It asks Verify.ET. 3. It checks status, amount, receiver and time. 4. It stores the claim, marks the payment `succeeded` and starts or extends the pass. 5. The page shows the new end date and an email is sent.
- **Alternate:** Reference not found: "We could not find this payment" (counts as an attempt). Amount too low: say how much was found. Wrong receiver: say it went to a different account. Transaction before the intent: say it is too early. Already used: 409. Over the limit: 429 with the wait time. Provider down: the payment becomes `under_review` and the user sees "We will check this by hand". Expired intent: ask them to create a new one and keep the reference for support.
- **Postcondition:** an active pass, or a payment under review.

### UC-32: Admin resolves a payment under review
- **Actor:** admin
- **Precondition:** a payment is `under_review`
- **Trigger:** opens the payment queue
- **Linked FR:** FR-68, FR-70, FR-76
- **Main flow:** 1. Admin opens the payment and sees the user, method, reference, amount, attempts and the receipt if any. 2. Admin checks the receiving account by hand. 3. Admin approves or rejects. 4. The user is told by email. 5. The audit log records it.
- **Alternate:** Two admins act at once: the second gets 409. Rejection without a reason is refused.
- **Postcondition:** the payment is `succeeded` with a pass, or `rejected`.

### UC-33: Receive a renewal reminder and renew
- **Actor:** user and the scheduled job
- **Precondition:** a pass ends in 7 days
- **Trigger:** the job runs
- **Linked FR:** FR-72, FR-74
- **Main flow:** 1. The job finds users with a pass ending in 7 days and no reminder yet. 2. It sends one email. 3. It marks the reminder as sent. 4. The user pays again (UC-30, UC-31) and the pass extends.
- **Alternate:** The job runs twice: no second email. The email fails: the mark is not set and the next run tries again. The user already extended: no reminder.
- **Postcondition:** reminder sent once per period.

### UC-34: View pass status and payment history
- **Actor:** user
- **Trigger:** opens the billing page
- **Linked FR:** FR-62, FR-71
- **Main flow:** 1. The page shows pass end date or "No active pass", free tickets left, and the payment list.
- **Alternate:** No payments yet: empty state with the steps.
- **Postcondition:** none.

### UC-35: Admin views the dashboard
- **Actor:** admin
- **Linked FR:** FR-75, FR-76, FR-79, FR-80, FR-59
- **Main flow:** 1. Admin signs in normally. 2. The admin menu appears. 3. The overview shows funnel, signups, passes, revenue, submissions, stuck items, emails today, AI usage. 4. The numbers refresh every 30 seconds.
- **Alternate:** A non-admin opens the address: 403. A metric query fails: that card shows an error, the others still load.
- **Postcondition:** none.

### UC-36: Admin manages users
- **Actor:** admin
- **Linked FR:** FR-77, FR-78, FR-76
- **Main flow:** 1. Search by email or name. 2. Open a user. 3. Optionally disable the account with a reason. 4. The user is signed out on the next request and cannot log in.
- **Alternate:** Disabling your own account is refused. Enabling restores login.
- **Postcondition:** the audit log has the action.

### UC-37: Admin revokes a certificate
- **Actor:** admin
- **Linked FR:** FR-78, FR-95, FR-76
- **Main flow:** 1. Open the user. 2. Revoke the certificate with a reason. 3. The public page now shows "Revoked".
- **Alternate:** Already revoked: 409.
- **Postcondition:** `revokedAt` is set.

### UC-38: Get a ticket by concept ladder
- **Actor:** verified user
- **Precondition:** has free tickets left or an active pass, GitHub connected, starter repo created, no active ticket
- **Trigger:** requests a ticket
- **Linked FR:** FR-81 to FR-84
- **Main flow:** 1. The server finds the user's ticket number. 2. It picks the tier. 3. It selects a template (doc 15 section 15.4). 4. Gemini fills in the scenario inside the fixed structure. 5. The ticket shows its tier and concepts.
- **Alternate:** No template left in the tier: use the next tier, then repeat with another scenario. Gemini fails: 502 and retry (unchanged).
- **Postcondition:** one active ticket.

### UC-39: Ask a clarifying question on an ambiguous ticket
- **Actor:** user
- **Linked FR:** FR-85
- **Main flow:** 1. The ticket has one unclear requirement. 2. The user asks the mentor. 3. The mentor answers the clarification within the hint rules.
- **Alternate:** The user never asks and guesses wrong: the first review notes it as a missed requirement.
- **Postcondition:** the question is in the transcript and counts in the communication score.

### UC-40: Receive communication feedback
- **Actor:** user
- **Linked FR:** FR-86 to FR-88
- **Main flow:** 1. After each review, the ticket page shows the three communication sub-scores and up to 3 tips. 2. The final score includes them in the 15%.
- **Alternate:** The PR has no description: the sub-score is low and the tip says how to write one. The PR text tries to give instructions to the evaluator: it is ignored and flagged.
- **Postcondition:** the evaluation holds the breakdown.

### UC-41: Read the communication guide
- **Actor:** any logged-in user
- **Linked FR:** FR-89
- **Main flow:** 1. Open the guide from the ticket page or the menu. 2. Read the four sections with good and weak examples.
- **Postcondition:** none.

### UC-42: Track certificate progress
- **Actor:** user
- **Linked FR:** FR-90, FR-91
- **Main flow:** 1. Open the certificate page. 2. See tasks done out of 5 and the current average. 3. If eligible, the "Claim" button is on.
- **Alternate:** 5 tasks but the average is 58%: the page says "Your average is 58%. You need 60%. Complete another task to raise it."
- **Postcondition:** none.

### UC-43: Claim a certificate
- **Actor:** eligible user
- **Linked FR:** FR-92, FR-94, FR-96
- **Main flow:** 1. Confirm the display name. 2. The system re-checks eligibility inside a transaction. 3. It creates the certificate and shows the link, print and LinkedIn options.
- **Alternate:** Not eligible any more: 409. Already has one: the existing one is shown. Unverified email: 403.
- **Postcondition:** one certificate exists for the user.

### UC-44: Verify a certificate (public)
- **Actor:** anyone (for example an employer)
- **Linked FR:** FR-93, FR-95
- **Main flow:** 1. Open the link. 2. See valid or revoked, the details and the disclaimer.
- **Alternate:** Unknown ID: 404. Too many requests: 429.
- **Postcondition:** none.

### UC-45: Visit the landing page
- **Actor:** visitor
- **Linked FR:** FR-97 to FR-99, FR-103, FR-104
- **Main flow:** 1. The page explains the product in the order given in FR-97. 2. The visitor reads pricing and stories. 3. They register or log in.
- **Alternate:** A testimonial without recorded permission is not shown.
- **Postcondition:** none.

### UC-46: Learn how it works in the flow
- **Actor:** user
- **Linked FR:** FR-100
- **Main flow:** 1. On the ticket page the user opens "What is a branch / pull request / test run / CI?". 2. A short explanation opens in place. 3. The submission page shows what is happening now (tests running, evaluating).
- **Postcondition:** none.

### UC-47: Complete the onboarding checklist
- **Actor:** new user
- **Linked FR:** FR-101
- **Main flow:** 1. The dashboard shows four steps with status. 2. Each step links to its page. 3. The checklist hides when all four are done.
- **Postcondition:** none.

### UC-48: Send feedback
- **Actor:** logged-in user
- **Linked FR:** FR-106
- **Main flow:** 1. Open the feedback box. 2. Write up to 2,000 characters. 3. Send. 4. See a thank-you message.
- **Alternate:** Empty message: field error. Too many: 429.
- **Postcondition:** a feedback record exists.

### UC-49: Watch the video guide
- **Actor:** visitor or user
- **Linked FR:** FR-102
- **Main flow:** 1. Press play on the embedded video. 2. Captions are available.
- **Postcondition:** none.

---

Next: proceed to → [14. Database and API Changes, Product Phase](./work-simulator-data-and-api-product-phase.md)
