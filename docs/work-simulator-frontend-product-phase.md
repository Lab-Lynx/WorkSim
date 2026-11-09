# 16. Frontend Changes: Redesign, Landing, Guides, Billing, Certificates and Admin

Project: Work Simulator · Links back to: [13. Requirements and Use Cases](./work-simulator-requirements-product-phase.md), [14. Database and API Changes](./work-simulator-data-and-api-product-phase.md), [15. Templates, Rubric and Certificates](./work-simulator-ticket-templates-rubric-certificates.md)

New pages are PG-14 to PG-25. Decisions (D-P##) and assumptions (A-##) are in doc 12.

---

## 16.1 Pages

| PG | Page | Path | Access | Linked UC | Linked EP |
|---|---|---|---|---|---|
| PG-14 | Landing (redesign) | `/` | Public | UC-45, UC-49 | none |
| PG-15 | How it works | `/how-it-works` | Public | UC-46 | none |
| PG-16 | Communication guide | `/guides/communication` | Public | UC-41 | none |
| PG-17 | Billing (redesign) | `/billing` | Logged in | UC-30, UC-31, UC-33, UC-34 | EP-17, EP-35 to EP-38 |
| PG-18 | Certificate | `/certificate` | Logged in | UC-42, UC-43 | EP-51 to EP-53 |
| PG-19 | Public certificate | `/verify/:publicId` | Public | UC-44 | EP-54 |
| PG-20 | Admin overview | `/admin` | Admin | UC-35 | EP-40 |
| PG-21 | Admin payments (list and detail) | `/admin/payments`, `/admin/payments/:id` | Admin | UC-32 | EP-41 to EP-44 |
| PG-22 | Admin users (list and detail) | `/admin/users`, `/admin/users/:id` | Admin | UC-36, UC-37 | EP-45 to EP-49 |
| PG-23 | Admin audit log | `/admin/audit` | Admin | UC-35 | EP-50 |
| PG-24 | Admin feedback | `/admin/feedback` | Admin | UC-48 | EP-57 |
| PG-25 | Legal pages | `/legal/terms`, `/legal/privacy`, `/legal/refunds` | Public | UC-45 | none |

Existing pages that change: Login and Register (no guest, terms checkbox, FR-54, FR-103), Dashboard (checklist FR-101, banner FR-60, free tickets and pass status), Ticket page (tier, concepts, explainers FR-100, communication panel FR-88), Submission page ("what is happening now" FR-100), Profile (certificate progress FR-91), Settings.

Route guards: `/admin/*` needs a new `AdminRoute` wrapper. It checks `user.role === 'admin'` for the menu only. The server decides (FR-75). Public pages use an open wrapper that never redirects (as in the Experience Bank notes).

---

## 16.2 Full redesign

**Scope.** Every screen, in this order: landing, login and register, dashboard, ticket workspace (Ticket, Mentor, Submissions tabs), submission page, billing, certificate, profile, settings, admin.

**Process**
1. **Audit first.** Run the UI/UX refactor skill (Playwright script) against the staging URL. Save the P0 to P3 list in `docs/design/audit-YYYY-MM-DD.md` with screenshots. Do this before changing anything, so the redesign fixes real problems.
2. **Tokens.** Keep the brand: black and white, a serif display face for accents and a clean sans for text. Put colors, type scale, spacing, radius, shadows and motion in the Tailwind v4 theme. No colors written directly in components.
3. **Components.** One pass over Button, Input, Select, Textarea, Card, Badge, Tabs, Dialog, Table, Toast, Banner, Stepper, Progress, Skeleton, Empty state, Tooltip, Popover. Each has default, hover, focus, disabled, loading and error states.
4. **Screens.** Redo them in the order above. After each screen: the 5-second test (can a stranger say what the page is for?), a keyboard-only pass, a 320 px pass.
5. **Close P0 and P1 first**, then polish.

**Rules**
- Clear hierarchy: one main action per screen.
- Plain English. Short sentences. No jargon without an explainer link.
- Every list has a loading skeleton, an empty state and an error state with a retry.
- Motion is small and respects `prefers-reduced-motion`.
- Do not change behaviour while changing looks. Existing tests must still pass.

**Done means**
- All P0 and P1 items from the audit are closed. P2 and P3 are listed with owners.
- Targets (not gates): accessibility score 90 or more and Largest Contentful Paint under 2.5 seconds on mobile for landing, login, billing and ticket pages.
- No horizontal scroll at 320 px. Focus is always visible. Text contrast meets AA.

---

## 16.3 Landing page (PG-14)

**Sections, in order** (FR-97): hero, how it works (3 steps), concepts you practice, a real ticket preview, pricing, certificate, user stories, testimonials, FAQ, footer.

**Copy rules.** Say what is true today. Do not invent numbers, users or stories. If there are no real stories yet, hide that section.

**Hero.** Headline: "Your first job, before you get your first job." Line under it: "Practice real tickets, pull requests and code reviews with an AI mentor." Buttons: "Get started" and "How it works".

**How it works.** 1. Get a real ticket. 2. Code in your own editor and open a pull request. 3. Get feedback, improve, and get your score.

**Concepts.** Three short lists (React, Node, Django) showing the ladder from FR concept names, for example "Props, events, lists" then "Forms, data fetching, routing" then "State management, optimistic updates, accessibility".

**Pricing.** "3 free tickets. Then 450 ETB for a 30-day pass. Pay by CBE or Telebirr. Cancel by simply not renewing." Link to the refund page. One line: "A certificate needs 5 completed tasks, so it needs a pass."

**Certificate.** A picture of the public verification page (not a fake person) and the sentence: "Anyone can check it. It records practice work. It is not a degree."

**FAQ.** What is WorkSim? Do I need experience? Which languages? How is my work scored? Does the AI write my code? What is the certificate? How do I pay? What happens to my code and chat? (answer in the Privacy page) How do I get help?

**Footer.** Terms, Privacy, Refunds, How it works, Communication guide, support email, GitHub link only if the repo is public (it is private now, so no link).

**Content file** (A-92, FR-98): `src/content/landing.ts`, typed. No runtime editing. A change is a code change and a deploy.

### Testimonials (FR-99)

Only shown when `permission.given` is true. Quotes are word for word as received. Do not shorten, fix, or join them.

```ts
export const testimonials: Testimonial[] = [
  { id: 'dagmawi-1', name: 'Dagmawi Esayas', role: 'TBC (Q-23)',
    quote: 'I loved the idea just by reading the description',
    permission: { given: false, proof: '' } },
  { id: 'dagmawi-2', name: 'Dagmawi Esayas', role: 'TBC (Q-23)',
    quote: "The amount of external integrations just can't be vibe coded",
    permission: { given: false, proof: '' } },
  { id: 'dagmawi-3', name: 'Dagmawi Esayas', role: 'TBC (Q-23)',
    quote: 'Your good teamwork made it in time for such a big project.',
    permission: { given: false, proof: '' } },
  { id: 'yeabsra-1', name: 'Yeabsra Ashebir', role: 'TBC (Q-23)',
    quote: 'This is such a creative project, I really like it.',
    permission: { given: false, proof: '' } },
  { id: 'miheretab-1', name: 'Miheretab Samson', role: 'TBC (Q-23)',
    quote: 'The most dedicated team I saw...',
    permission: { given: false, proof: '' } },
  { id: 'frosty-1', name: 'frosty', role: 'TBC (Q-23)',
    quote: 'people are gonna say I am worksim certified',
    permission: { given: false, proof: '' } },
];
```

Before setting `given: true` for any entry: get written permission, save the message in the team's private documents, put its path in `proof`, confirm the name and role, and for Miheretab Samson get the full sentence (the quote ends with "..."). For "frosty" confirm whether this is a real name and a judge. Do not show it if unclear. The rank claim ("2nd place out of 76 projects") also needs a link to the official results (Q-24) before it goes on the page.

---

## 16.4 "How it works" explainers (PG-15, FR-100)

The same entries are shown on the page and in small popovers where the word appears (ticket page, submission page). Each entry has three lines. Keep them this short.

| ID | Term | What it is | On WorkSim | At work |
|---|---|---|---|---|
| EX-01 | Ticket | A small, clear task someone asks you to do. | Each ticket has a story, acceptance criteria and a test checklist. | Teams track work as tickets so everyone knows what is next. |
| EX-02 | Branch | A separate copy of the code where you can work safely. | We create a branch for your ticket in your own repo. | Nobody edits the main code directly. |
| EX-03 | Commit | A saved step in your work, with a short message. | Write what you did and why in each commit. We read them. | Good commits make problems easy to find later. |
| EX-04 | Pull request | A request to add your branch to the main code, so others can review it. | Open one when you are ready. We check it. | Every change is reviewed before it ships. |
| EX-05 | Automated tests | Code that checks if your code works. | They run on every push. Failing tests lower your score. | Tests stop old features from breaking. |
| EX-06 | CI | A robot that runs the tests and checks on every push. | GitHub Actions runs it in your repo and we read the result. | Teams do not merge code that fails CI. |
| EX-07 | CD | The step after CI that puts checked code in front of users. | Your starter repo practises CI. We explain CD so you know what comes next. | Many teams ship small changes many times a day. |
| EX-08 | Code review | Someone reads your change and gives feedback. | Review 1 gives feedback only. Review 2 gives your score. | Reviews catch mistakes and share knowledge. |

Page layout (PG-15): a simple left-to-right flow, "Ticket → Branch → Commits → Pull request → CI → Review → Merge", each box linking to its entry, plus the two-review explanation. The submission page shows a live status line: "Tests are running", "Waiting for review", "Review ready".

---

## 16.5 Communication guide (PG-16, FR-89)

Four short sections. Each has "Do", "Avoid" and a weak and a good example.

1. **Asking for help.** Do: say what you want, what you tried, and what happened. One question at a time. Avoid: "It doesn't work", "Do it for me." Weak: "I don't understand." Good: "I want the share button to open a menu. I added the icon in `button.tsx` but it does not show on the homepage. Where should I import it?"
2. **Writing a pull request description.** Do: say what changed, why, and how you tested it. Avoid: an empty box. Weak: "done". Good: "Adds a share button with an icon. It follows the design system focus style. I tested it with the keyboard and added two tests."
3. **Writing commit messages.** Do: start with a verb, be specific, keep it short. Avoid: "fix", "update", "wip". Weak: "fix stuff". Good: "Add share icon to Button variants".
4. **Responding to review comments.** Do: answer every point, say what you changed, say if you disagree and why. Avoid: ignoring a point. Weak: "ok". Good: "Fixed the focus state in `button.tsx`. I kept the label as is because the design system uses it. Happy to change it."

The ticket page links to this guide, and the communication panel (FR-88) shows the tips next to the three sub-scores.

---

## 16.6 Billing page (PG-17)

**States**
| State | What the user sees |
|---|---|
| No pass | Price, free tickets left, how it works in 3 steps, two buttons "Pay with CBE" and "Pay with Telebirr". |
| Open intent | Amount, payee name and account, the code, a countdown to expiry, a field for the reference, "Verify payment". A "Copy" button on each value. |
| Verifying | A spinner and "Checking your payment. This can take a few seconds." Maximum 10 seconds, then the error or review state. |
| Succeeded | "Your pass is active until {date}." and a button to the dashboard. |
| Under review | "We could not check this automatically. We will review it by hand and email you." |
| Expired intent | "This payment request expired. Create a new one. If you already paid, keep your reference and email {support}." |
| Active pass | End date, "Renew" button (starts a new intent that extends the pass), payment history. |
| Unverified email | Banner, buttons disabled with the reason. |

**Steps text.** 1. Choose a method. 2. Send exactly the amount to the account shown. 3. Paste the transaction reference. 4. We check it and start your pass.

**Messages by error code** (from `code`, with a fallback to status and message)
| Code or status | Message |
|---|---|
| `EMAIL_NOT_VERIFIED` | "Please verify your email first. We sent a link to {email}." |
| `INVALID_REFERENCE_FORMAT` | "Check the reference. It should be 6 to 40 letters and numbers." |
| 422 (not found, too low, wrong account, too early) | Show the server message. |
| `REFERENCE_ALREADY_USED` | "This reference was already used. If this is a mistake, email {support}." |
| `INTENT_EXPIRED` | The expired text above. |
| `TOO_MANY_ATTEMPTS` | "Too many tries. Please wait and try again." |
| 202 | The under-review text. |

Payments are never started or confirmed by voice (D-P18).

---

## 16.7 Certificate pages (PG-18, PG-19)

**PG-18, progress.** "Tasks done: 4 of 5", a progress bar, "Average: 63.5%", and a list of what is missing from EP-51. If eligible: "Claim your certificate". The claim dialog asks for the name to show (2 to 80 characters) and explains that it cannot be changed later.

**PG-18, after claim.** The certificate card, "Copy link", "Print or save as PDF" (a print-friendly style), "Add to LinkedIn" (opens LinkedIn's add certification page with the name, issuer, date and link filled in; confirm the exact fields when building).

**PG-19, public.** Plain page, no login, no menu except a small WorkSim logo and "What is WorkSim?". Shows status (Valid or Revoked with date), name, issue date, number of tasks, average, the four rubric averages as simple bars, concepts, stacks, the task list and the disclaimer. It never shows email or repository links. It has the same look in print.

---

## 16.8 Admin screens (PG-20 to PG-24)

- **Layout.** Left navigation: Overview, Payments, Users, Audit log, Feedback. A small "Updated 12 seconds ago" label on the overview.
- **Overview.** Cards: funnel (as a horizontal list with counts and percent of the previous step), signups per day (simple chart), active passes and passes ending in 7 days, revenue, submissions by status and the number processing over 15 minutes, email sent today against the limit (warning at 180), AI calls by provider. Each card loads and fails alone.
- **Payments.** A table, filter by status (default "Under review"). Detail page: user, method, reference, amount, attempts list, receipt (if built), buttons Approve and Reject. Both open a dialog. Reject needs a reason.
- **Users.** Search box. Detail: verified, role, pass end date, tickets with tier and score, payments, certificate, integrity flags (if built). Buttons: Disable or Enable (with reason), Revoke certificate (with reason).
- **Audit log.** Table with actor, action, target, note, time. Filter by action.
- **Feedback.** List with page, message, time.
- **Safety.** Every destructive action asks for confirmation and a reason. Tables work with a keyboard. No raw IDs are the only identifier on screen: show names and emails too.

---

## 16.9 Other changes

- **Verify banner** (FR-60): shown on every logged-in page until verified, with "Resend email" and the cool-down time.
- **Onboarding checklist** (FR-101): on the dashboard. Steps: verify email, connect GitHub, pick a stack, get your first ticket. Each links to its page. It hides when done.
- **Feedback box** (FR-106): a small button in the footer of the app shell. Opens a dialog with a text field and a send button.
- **Terms prompt** for existing users: a one-time dialog asking them to accept the current Terms and Privacy Policy (FR-107).
- **Removed.** `GuestLoginButton`, `useGuestLogin`, the guest query keys, and any guest text on Login and Register. Remove their tests.

---

## 16.10 Hooks and API modules (new)

| Hook | Endpoint | Notes |
|---|---|---|
| `usePaymentInfo` | EP-35 | Cache 5 minutes |
| `useCurrentIntent` | EP-38 | Refetch when the page gets focus |
| `useCreateIntent` | EP-36 | On success set the current intent in the cache |
| `useVerifyPayment` | EP-37 | Handles 200, 202 and 422; invalidates payments, subscription and `useMe` |
| `usePayments` | EP-17 | Existing, new statuses |
| `useCertificateEligibility` | EP-51 | |
| `useMyCertificate` | EP-53 | |
| `useClaimCertificate` | EP-52 | Invalidates both certificate queries |
| `usePublicCertificate` | EP-54 | No retry on 404 |
| `useAdminOverview` | EP-40 | `refetchInterval` 30 seconds, pause when the tab is hidden |
| `useAdminPayments`, `useAdminPayment`, `useApprovePayment`, `useRejectPayment` | EP-41 to EP-44 | |
| `useAdminUsers`, `useAdminUser`, `useDisableUser`, `useEnableUser`, `useRevokeCertificate` | EP-45 to EP-49 | |
| `useAuditLog` | EP-50 | Cursor pagination |
| `useAdminFeedback`, `useSendFeedback` | EP-57, EP-55 | |
| `useAcceptTerms` | EP-59 | |
| `useResendVerification` | existing | Cool-down kept in the hook |

**Error codes.** The shared error type gets an optional `code`. A small `error-codes.ts` maps each code to a message and to a field or banner. `friendly-error.ts` uses it first.

**Folders.** `src/features/payments`, `src/features/admin`, `src/features/certificates`, `src/content` (landing, explainers, communication guide, testimonials, legal text). Pages stay thin.

**Voxide.** Add read-only actions `getPaymentStatus` and `getCertificateProgress`. Do not add actions for paying, verifying, claiming or admin work (D-P18). Existing `dangerous` flags stay.

---

## 16.11 Quality bar for new pages

- Loading skeleton, empty state, error state with retry.
- Works from 320 px. Keyboard works. Focus is visible. Labels on every field. Errors are announced to screen readers.
- Dates in the user's locale. Amounts as "450 ETB".
- Text is plain English and lives in content files or one place per feature, so Amharic can be added later.
- Tests for each hook and page (doc 17).

---

Next: proceed to → [17. Test Plan, Product Phase](./work-simulator-test-plan-product-phase.md)
