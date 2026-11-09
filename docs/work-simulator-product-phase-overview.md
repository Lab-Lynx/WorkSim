# 12. Product Phase (V1.1): Overview, Decisions and Work Packages

Project: Work Simulator · Links back to: [1. Problem & Solution](./work-simulator-problem-solution-v2.md), [2. Requirements](./work-simulator-requirements.md), [11. Test Plan, Frontend](./work-simulator-test-plan-frontend.md)

This document starts the Product Phase. It records what the team decided after the competition, the work packages (WP-##), the assumptions (A-79 to A-104) and the open questions (Q-21 to Q-33). Every later document in this phase (13 to 17) points back here for decisions and assumptions, so they are written once.

**Numbering continues from the earlier series.** Nothing is renumbered. New IDs start at: FR-54, UC-28, EP-35, DR-12, A-79, Q-21, PG-14, WP-01, D-P01, TC-01.

---

## 12.1 Goal and non-goals

**Goal.** Turn the competition build into a product that real students can pay for and trust, in the next two weeks of coding.

**What "product" means here**
- Students can register with a verified email, pay 450 ETB for a 30-day pass by bank or wallet transfer, and have it verified automatically.
- Tickets teach real concepts (state management, authentication, and so on), not only file edits.
- The final review also teaches workplace communication.
- A student who completes 5 tasks with an average of at least 60% can claim a certificate that anyone can verify.
- The team can see what is happening (payments to review, users, funnel, AI cost) in an admin panel.
- The landing page and guides explain the product in plain language and show honest proof.

**Non-goals for this phase**
- Automatic recurring billing (not possible with transfer receipts, see D-P04).
- A content management system or inline editing on the landing page (D-P13).
- Public profiles, leaderboards, employer features, mobile apps.
- Payments by voice (D-P18).

---

## 12.2 Decisions

D-P15 and D-P16 are not used in this set.

| ID | Decision | Notes |
|---|---|---|
| D-P01 | Payment verification uses **Verify.ET**. Jami is rejected (7% fee). Chapa stays in the code but is switched off until the team has a business registration. | Chapa needs business registration documents. |
| D-P02 | Price: **450 ETB per 30-day pass**. The first **3 tickets stay free**. | Test the price in user research (Q-32). |
| D-P03 | Launch payment methods: **CBE and Telebirr**. The receiving accounts are environment variables. | See doc 14 for the names. |
| D-P04 | The "subscription" becomes a **pass**. No auto-renewal. The old renewal job becomes a **reminder email 7 days before the pass ends**. | Closes the long-open renewal gap (D-08 of the earlier log). |
| D-P05 | Email uses **Mailjet** (free tier). The app counts emails per day and warns at 180. | The free tier has a hard daily limit. |
| D-P06 | **Verified email is required** to get a ticket, to pay, and to claim a certificate. Browsing stays open. | Replaces the paused check. Resolves Q-04. |
| D-P07 | **Guest login is removed completely**: button, endpoints, settings and the demo account. | |
| D-P08 | Ticket difficulty is **concept based**, not file-count based. Concepts sit on a 3-level ladder per stack. | See doc 15. |
| D-P09 | At least **6 templates per stack** (2 per tier). Selection rule in doc 15. Resolves Q-09. | |
| D-P10 | Communication is scored **inside the existing 15%** category. Weights do not change. | |
| D-P11 | Certificate: **5 scored tasks, average of all scored tasks at least 60%**, abandoned tasks ignored, verified email, one per user. | |
| D-P12 | **Admin** is a role granted by a script, every admin write is in an **audit log**, metrics refresh about every 30 seconds. | |
| D-P13 | Landing content lives in **one typed file in code**. No CMS. | |
| D-P14 | The GitHub repository is **private** from now on. The git history is scanned for secrets once. | The repo was public during judging. |
| D-P17 | New endpoints can return a machine-readable **`code`** in the error envelope. Old endpoints are unchanged. | Needed because 403 and 409 now mean several things. |
| D-P18 | Voxide never performs payment actions. Read-only actions may be added. | Money needs a deliberate click. |
| D-P19 | The Render proxy fix (`trust proxy`) ships in its own PR. | Listed here for completeness. |
| D-P20 | The video guide is **optional** (Could). It is recorded after the redesign. | |
| D-P21 | Marketing starts with a **closed beta**. No code work. | |

---

## 12.3 Reconciliation: what older documents say, and what changes

| Topic | Older documents | Now |
|---|---|---|
| Paid gate | Docs 2 and 5 say "+ Sub" gates many endpoints (FR-15, A-22). | The code gates **ticket assignment (EP-23)** with 3 free tickets, then a paid pass. Docs 2 and 5 are updated to match (FR-54 to FR-107 and section 13.4). |
| Email check before checkout | Doc 5 EP-13 and Q-04 resolved "verification blocks checkout". | The check was paused during the competition. It returns as FR-57. |
| Chapa subscription endpoints | EP-13, EP-14, EP-16 | Stay in the code behind a provider interface, disabled by config (FR-73). The UI uses the new pass flow. |
| Renewal job | D-08 (platform charges monthly) | Replaced by a reminder email (FR-72). |
| Guest login | Not documented. Exists as `GET/POST /auth/guest`. | Removed (FR-54, FR-55). |
| Open questions | Q-04, Q-05, Q-07, Q-09 | Q-04 closed by FR-57. Q-05 and Q-07 are obsolete under the pass model. Q-09 closed by FR-83. |
| Problem solving (15%) | One score | Three sub-scores inside the same 15% (FR-86, FR-87). |

---

## 12.4 Work packages

| WP | Task | Priority | Depends on |
|---|---|---|---|
| WP-01 | Remove guest mode | Must | none |
| WP-02 | Fix Render proxy (`trust proxy`) | Must | none (PR in progress) |
| WP-03 | Mailjet email and verified-email enforcement | Must | none |
| WP-04 | Verify.ET pass payments, receipts, renewal reminder | Must | WP-03 (emails), WP-05 (review queue) |
| WP-05 | Admin panel, analytics, audit log | Must | none |
| WP-06 | Ticket template expansion (concept ladders) | Must | none |
| WP-07 | Communication scoring and feedback | Must | GitHub PR metadata (inside WP-07) |
| WP-08 | Certificates | Must | WP-03, WP-06 |
| WP-09 | Full UI/UX redesign | Must | none |
| WP-10 | Landing page, stories, testimonials, pricing | Must | WP-09 tokens, WP-19 |
| WP-11 | "How it works" explainers, communication guide | Must | WP-09 |
| WP-12 | Video guide | Could | WP-09 |
| WP-13 | User research | Must | beta users, WP-09 first pass |
| WP-14 | Security and bug checks | Must | continuous, final after WP-04, WP-05, WP-08 |
| WP-15 | GitHub integration policies and OAuth app settings | Must | none |
| WP-18 | Marketing and promotion | Should | closed beta |
| WP-19 | Testimonial permissions and proof | Must | none |

---

## 12.5 Order of work (by dependency)

- **Days 1 to 3.** WP-02, WP-01, WP-03. Admin role and audit log (WP-05 backend). Payment schema, migrations and provider interface (WP-04). Template schema v2 and concept catalog (WP-06). Design tokens and component audit (WP-09).
- **Days 4 to 7.** Verify.ET flow and payment screens (WP-04). Payment review queue, users, overview (WP-05). Templates written (WP-06). PR metadata and communication scoring (WP-07). Certificate backend (WP-08). Landing build (WP-10).
- **Days 8 to 11.** Certificate screens and communication panel (WP-08, WP-07). Explainers and guide (WP-11). AI usage log (WP-05). GitHub settings (WP-15). First beta users start (WP-13).
- **Days 12 to 14.** Final security pass (WP-14). Fixes from research. Full regression and release checklist (doc 17). Video if time allows (WP-12).

---

## 12.6 Risks

| Risk | Why it matters | Reduce it by |
|---|---|---|
| Payment fraud or reference guessing | Someone claims another person's transfer | Intent time rule, one-claim-per-reference, attempt limits, admin flags (docs 13, 14) |
| Verify.ET changes, costs or is down | Payment depends on it | Under-review fallback, adapter interface, check pricing first (Q-21) |
| Mailjet daily limit (200) | A busy day stops verification emails | Counter and warning at 180, resend cooldown, move to a paid plan when needed |
| AI cost grows with users | 450 ETB must cover AI, email, verification | AI usage log (FR-80), cost per user view in admin, per-ticket limits |
| Cheating weakens certificates | The certificate loses meaning | Communication score, CI evidence, similarity flags (Could), revocation |
| Prompt injection through PR text | PR title, body and commits now go to the evaluator | Treat as untrusted data (FR-86, doc 15) |
| GitHub policy or rate limits | The core loop depends on GitHub | Policy review (WP-15), clear error states |
| Student code and chat go to AI vendors | Privacy | State it in the app's privacy text, check vendor data terms |
| Free-tier hosting | Cold starts hurt first impressions | Decide on a paid plan (Q-33) |

---

## 12.7 Assumptions

| ID | Assumption |
|---|---|
| A-79 | Verify.ET returns status, amount, receiver and transaction time for CBE and Telebirr transactions. To confirm (Q-21). |
| A-80 | An overpayment is accepted and not refunded. The extra amount is noted on the payment. |
| A-81 | A payment intent expires 48 hours after creation. The transaction time must not be before the intent was created. |
| A-82 | Verification attempts are limited to 5 per hour and 20 per day per user, counted from attempt rows. |
| A-83 | A user has at most one open intent. Asking again with the same method returns the same intent. A different method replaces it. |
| A-84 | A pass lasts 30 days. Paying during an active pass extends it from the current end date. |
| A-85 | Price and duration come from settings (`PASS_PRICE_ETB`, `PASS_DURATION_DAYS`). The amount is copied onto each payment. |
| A-86 | The renewal reminder is sent once per pass period, 7 days before it ends. The mark resets when the pass is extended. |
| A-87 | The admin role is granted only by a script run by a maintainer. There is no screen to grant it. Each grant is logged. |
| A-88 | "Real time" means a screen refresh every 30 seconds, backed by a 15 second server cache. |
| A-89 | One certificate per user. Its numbers are a snapshot at claim time. |
| A-90 | The average counts every ticket in status `done` that has a final evaluation. Abandoned tickets are ignored. |
| A-91 | The public certificate page needs no login, is rate limited, and never shows email or repository links. |
| A-92 | Landing text lives in one typed content file. No CMS. |
| A-93 | Email goes through Mailjet (`node-mailjet`, Send API v3.1) behind the existing `EmailProvider` interface. `EMAIL_PROVIDER` chooses `mailjet`, `resend` or `console`. |
| A-94 | Guest data is deleted by a script that runs in dry-run mode first, after a database backup. |
| A-95 | A template's tier is its highest concept level. Tickets 1 and 2 use Tier 1, tickets 3 and 4 use Tier 2, ticket 5 and later use Tier 3. |
| A-96 | Communication sub-scores sit inside the existing 15% category. |
| A-97 | Template target: at least 6 per stack (18 in total). Stretch: 9 per stack. |
| A-98 | Each template lists what the starter repo must already contain. A manifest in the backend repo records what each starter provides, and a test compares the two. |
| A-99 | Users who registered before this phase are not marked verified. They verify on their next login. |
| A-100 | The Render proxy fix ships separately and is treated as done here. |
| A-101 | Chapa code stays in the repo, switched off, until the team has a business registration. |
| A-102 | The error envelope gains an optional `code` string for new endpoints. |
| A-103 | Certificate wording says "practice completion", never "qualification" or "employer verified". |
| A-104 | A testimonial is shown only with written permission, in the exact words given. |

---

## 12.8 Open questions

Q-29, Q-30 and Q-31 are not used in this set.

| ID | Question |
|---|---|
| Q-21 | Verify.ET: exact request and response fields, price per check, quotas, supported CBE and Telebirr receipt types, uptime. |
| Q-22 | Receipt screenshot fallback needs private file storage. Which provider, or drop the fallback? |
| Q-23 | Testimonials: written permission from each person, correct attribution for "frosty", the full Miheretab Samson quote, the event name. |
| Q-24 | Official proof (link) for "2nd place out of 76 projects". |
| Q-25 | Landing page analytics: Plausible, Umami, or none. |
| Q-26 | Scheduler for the reminder job: GitHub Actions cron or a Render cron job. |
| Q-27 | Disable-user is a Should. Confirm it is in scope. |
| Q-28 | GitHub OAuth App or GitHub App. |
| Q-32 | Keep 450 ETB after user research? |
| Q-33 | Stay on the free hosting plan after launch, or move to a paid one? |

---

## 12.9 Decision log entries (append to `docs/decisions-log.md`)

Copy the table in 12.2 into the log with today's date, and add one row: "Docs 12 to 19 added for the Product Phase."

Next: proceed to → [13. Requirements and Use Cases, Product Phase](./work-simulator-requirements-product-phase.md)
