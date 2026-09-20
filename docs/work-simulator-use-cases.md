# 3. Use Cases

Project: Work Simulator · Links back to: [2. Functional & Non-Functional Requirements](./work-simulator-requirements.md)

27 use cases below, grouped in the same order as the requirements doc. Every one links back to at least one FR; none introduce new scope that isn't already in that doc. Two of them (UC-11, UC-14) are system-triggered rather than user-triggered — Chapa's webhook is the "actor," not a person — worth keeping those two in mind when API endpoints get designed next, since they're server-to-server, not a browser request.

`FR-29` (GitHub token revoked mid-session) and `FR-53` ("Voxide," still unresolved) aren't tied to one single use case — FR-29 is called out as an alternate flow wherever a use case touches the GitHub API, and FR-53 has no use case yet since its scope isn't defined.

---

### UC-01: Register

| Field | Detail |
|---|---|
| Actor | Anonymous visitor |
| Precondition | Actor does not already have an account |
| Trigger | Actor submits the registration form (name, email, password) |
| Linked FR | FR-01, FR-02, FR-03 |

Main flow:
1. Actor enters name, email, and password
2. System validates the password meets the minimum length
3. System checks the email isn't already registered
4. System creates the account and sends a verification email (see UC-02)
5. System logs the actor in immediately (access + refresh cookies set) — verification is required before subscribing (UC-10), not before browsing

Alternate / error flows:
- Password under 8 characters: system returns 400 with a specific message, no account created
- Email already registered: system returns 409, no account created

Postcondition (success): Account exists, actor is logged in, verification email sent, account not yet verified.

---

### UC-02: Verify Email

| Field | Detail |
|---|---|
| Actor | Registered user (via emailed link, may not be logged in on this device) |
| Precondition | Actor has an unverified account and holds a verification link |
| Trigger | Actor clicks the verification link |
| Linked FR | FR-05, FR-06 |

Main flow:
1. Actor clicks the link from their email
2. System validates the token and marks the account verified
3. System shows a confirmation and directs the actor to log in (or continue, if already logged in on this device)

Alternate / error flows:
- Link already used: system shows "already verified" rather than an error, does not treat this as a failure
- Link expired: system shows an "expired" message with a button to resend a new verification email

Postcondition (success): Account marked verified; actor can now subscribe (UC-10).

---

### UC-03: Log In

| Field | Detail |
|---|---|
| Actor | Registered user |
| Precondition | Actor has an account |
| Trigger | Actor submits email + password on the login form |
| Linked FR | FR-04, FR-12 |

Main flow:
1. Actor enters email and password
2. System validates credentials
3. System sets access + refresh tokens as httpOnly cookies
4. Actor is redirected to their dashboard

Alternate / error flows:
- Wrong email or password: system returns 401 with a generic "invalid email or password" (never reveals which field was wrong)
- Too many failed attempts in a short window: system rate-limits further attempts on that account (FR-12)

Postcondition (success): Actor is logged in; session cookies set.

---

### UC-04: Request Password Reset

| Field | Detail |
|---|---|
| Actor | Registered user who forgot their password |
| Precondition | Actor knows the email on their account |
| Trigger | Actor submits their email on the "forgot password" form |
| Linked FR | FR-07 |

Main flow:
1. Actor enters their email
2. System generates a one-time, time-limited reset link and emails it
3. System shows a generic "if that email exists, a reset link was sent" message — regardless of whether the email is actually registered, so the form can't be used to check which emails have accounts

Alternate / error flows:
- Email not registered: system still shows the same generic success message (no account created, no email sent, but the actor can't tell the difference)

Postcondition (success): Reset email sent if the account exists; nothing observably different to the actor either way.

---

### UC-05: Reset Password

| Field | Detail |
|---|---|
| Actor | Registered user (via emailed link) |
| Precondition | Actor holds a valid, unused, unexpired reset link |
| Trigger | Actor submits a new password on the reset form |
| Linked FR | FR-07, FR-08 |

Main flow:
1. Actor opens the reset link and enters a new password
2. System validates the token is valid, unused, and unexpired
3. System updates the password and invalidates the reset token
4. System logs the actor out of all existing sessions (forces re-login with the new password)

Alternate / error flows:
- Token already used: system rejects the reset, password unchanged, shows "this link has already been used, request a new one"
- Token expired: system rejects the reset, shows "this link has expired, request a new one"

Postcondition (success): Password changed; all prior sessions revoked; actor must log in again.

---

### UC-06: Change Password

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor is authenticated |
| Trigger | Actor submits current password + new password on their account settings page |
| Linked FR | FR-09 |

Main flow:
1. Actor enters current password and a new password
2. System verifies the current password is correct
3. System updates the password

Alternate / error flows:
- Current password incorrect: system rejects the change, returns 401, password unchanged

Postcondition (success): Password updated; current session remains valid.

---

### UC-07: Log Out

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor is authenticated |
| Trigger | Actor clicks "log out" |
| Linked FR | FR-10 |

Main flow:
1. Actor clicks log out
2. System revokes the current refresh token and clears both cookies
3. Actor is redirected to the login page

Alternate / error flows:
- None expected — logout succeeds even if the refresh token was already invalid/missing, since the end state (logged out) is the same either way

Postcondition (success): Current session's tokens cleared and revoked.

---

### UC-08: Log Out of All Devices

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor is authenticated |
| Trigger | Actor clicks "log out of all devices" in account settings |
| Linked FR | FR-11 |

Main flow:
1. Actor clicks "log out everywhere"
2. System revokes every refresh token issued to this user's account, not just the current one
3. Every other logged-in session (other browsers/devices) is forced to re-authenticate on its next request

Alternate / error flows:
- None expected

Postcondition (success): All sessions for this user are invalidated; only a fresh login works anywhere.

---

### UC-09: Edit Display Name

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor is authenticated |
| Trigger | Actor submits a new display name in account settings |
| Linked FR | FR-13 |

Main flow:
1. Actor enters a new display name
2. System validates it's non-empty and under the length limit
3. System saves it

Alternate / error flows:
- Empty or over-length name: system rejects with 400, name unchanged

Postcondition (success): Display name updated.

---

### UC-10: Subscribe

| Field | Detail |
|---|---|
| Actor | Logged-in, verified user without an active subscription |
| Precondition | Actor's email is verified (see UC-02) |
| Trigger | Actor clicks "subscribe" |
| Linked FR | FR-15, FR-16, FR-17 |

Main flow:
1. Actor clicks subscribe
2. System creates a pending subscription record and redirects the actor to Chapa's hosted checkout
3. Actor completes payment on Chapa's page (card/mobile-money details never touch the platform's own servers)
4. Chapa redirects the actor back to the platform with a success indicator
5. Platform shows "processing" rather than immediately marking the subscription active — the real confirmation is the webhook (UC-11), which may arrive slightly after the redirect

Alternate / error flows:
- Actor not yet email-verified: system blocks this flow before reaching Chapa, shows "verify your email first" with a resend option
- Actor cancels on Chapa's page: returned to the platform, subscription stays unconfirmed, actor can retry

Postcondition (success): Pending subscription created; actor redirected to Chapa; final confirmation happens via UC-11, not this flow alone.

---

### UC-11: Confirm Subscription (Chapa Webhook)

| Field | Detail |
|---|---|
| Actor | Chapa (server-to-server webhook, not a person) |
| Precondition | A pending subscription exists from UC-10 |
| Trigger | Chapa sends a payment-confirmed webhook event |
| Linked FR | FR-18, FR-19 |

Main flow:
1. Chapa sends a signed webhook to the platform's payment endpoint
2. System verifies the signature
3. System marks the subscription active and records the Chapa transaction reference
4. Actor's next ticket assignment (UC-19) is now unblocked

Alternate / error flows:
- Invalid or missing signature: system rejects the webhook with an error, does not activate any subscription, logs the rejection distinctly (see NFR on payment webhook logging)
- Webhook for a subscription the system has no pending record for: system logs and ignores it rather than creating a subscription out of nowhere

Postcondition (success): Subscription is active; user can now be assigned tickets.

---

### UC-12: View Subscription Status

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor is authenticated |
| Trigger | Actor opens the billing/account page |
| Linked FR | FR-20 |

Main flow:
1. Actor opens their account/billing page
2. System shows current status (active / past due / canceled) and next billing date

Alternate / error flows:
- No subscription ever started: system shows "not subscribed" with a link to UC-10

Postcondition (success): Actor sees accurate, current subscription status.

---

### UC-13: Cancel Subscription

| Field | Detail |
|---|---|
| Actor | Logged-in user with an active subscription |
| Precondition | Subscription is active |
| Trigger | Actor clicks "cancel subscription" |
| Linked FR | FR-21 |

Main flow:
1. Actor clicks cancel and confirms
2. System marks the subscription "canceling" — access remains until the current paid period ends
3. At period end, a scheduled check (or the next Chapa renewal webhook, which won't arrive since it's canceled) flips status to "canceled" and blocks new ticket assignment

Alternate / error flows:
- Actor cancels, then wants to resume before the period ends: system allows un-canceling back to "active" without a new checkout, since the current paid period hasn't lapsed

Postcondition (success): Subscription set to cancel at period end; access continues until then.

---

### UC-14: Handle Failed Recurring Payment (Chapa Webhook)

| Field | Detail |
|---|---|
| Actor | Chapa (server-to-server webhook) |
| Precondition | User has an active subscription due for renewal |
| Trigger | Chapa sends a payment-failed webhook for a recurring charge |
| Linked FR | FR-22 |

Main flow:
1. Chapa sends a signed "payment failed" webhook
2. System verifies the signature
3. System moves the subscription to "past due" (access not immediately revoked)
4. System sends the user a transactional email explaining the failed payment and how to update it

Alternate / error flows:
- Invalid signature: rejected and logged, same as UC-11
- User's payment method still fails after a grace period: subscription moves to "canceled," access revoked on next ticket-assignment check

Postcondition (success): Subscription marked "past due"; user notified by email.

---

### UC-15: View Payment History

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor has made at least one payment attempt |
| Trigger | Actor opens the billing history page |
| Linked FR | FR-23 |

Main flow:
1. Actor opens billing history
2. System lists past payments: date, amount, status

Alternate / error flows:
- No payment history yet: system shows an empty state, not an error

Postcondition (success): Actor sees an accurate list of past payments.

---

### UC-16: Connect GitHub Account

| Field | Detail |
|---|---|
| Actor | Logged-in, subscribed user |
| Precondition | Subscription is active; GitHub not yet connected |
| Trigger | Actor clicks "connect GitHub" |
| Linked FR | FR-25 |

Main flow:
1. Actor clicks connect and is sent to GitHub's OAuth consent screen, scoped to repo creation + push only
2. Actor approves
3. GitHub redirects back with an authorization code
4. System exchanges it for an access token and stores it (never logged, minimum scope only)

Alternate / error flows:
- Actor denies the OAuth request on GitHub's screen: returned to the platform, still not connected, clear message shown, can retry

Postcondition (success): GitHub account linked; actor can now start a project (UC-18).

---

### UC-17: Disconnect GitHub Account

| Field | Detail |
|---|---|
| Actor | Logged-in user with GitHub connected |
| Precondition | GitHub is currently connected |
| Trigger | Actor clicks "disconnect GitHub" |
| Linked FR | FR-26 |

Main flow:
1. Actor clicks disconnect and confirms
2. System deletes the stored GitHub token
3. Past submissions/tickets remain visible; starting a new ticket is blocked until reconnected

Alternate / error flows:
- None expected

Postcondition (success): GitHub token removed; new ticket assignment blocked until UC-16 is repeated.

---

### UC-18: Start Project

| Field | Detail |
|---|---|
| Actor | Logged-in, subscribed user with GitHub connected |
| Precondition | No project/repo started yet for this user |
| Trigger | Actor picks a starter template (React or Node/Express) and confirms |
| Linked FR | FR-27, FR-28 |

Main flow:
1. Actor selects a starter template
2. System creates a new repo in the actor's GitHub account from that template
3. System records the repo as this user's active project

Alternate / error flows:
- Repo name collision: system appends a disambiguating suffix or asks the actor to pick a different name, does not fail silently
- GitHub API error (rate limit, outage): system shows a specific "GitHub is having trouble right now, try again" message, does not lose the actor's template selection
- GitHub token invalid/revoked at this point (FR-29): system detects the failure, prompts a reconnect (back to UC-16) instead of a generic error

Postcondition (success): A real GitHub repo exists under the actor's account, linked to their profile; they're ready for their first ticket (UC-19).

---

### UC-19: Get Next Ticket

| Field | Detail |
|---|---|
| Actor | Logged-in, subscribed user with a started project |
| Precondition | No currently active (non-`done`) ticket for this user |
| Trigger | Actor requests a new ticket (or automatically, right after finishing the previous one) |
| Linked FR | FR-30, FR-31, FR-32, FR-34 |

Main flow:
1. System selects a ticket structure/template appropriate to the actor's chosen stack
2. System asks the AI (Gemini) to fill in the ticket's specific wording/scenario within that fixed structure
3. System creates the ticket in `assigned` state and shows it to the actor, including acceptance criteria and test checklist
4. Actor begins work; ticket moves to `in_progress`

Alternate / error flows:
- Actor already has an active ticket: system blocks this and shows the existing one instead (FR-34)
- AI content generation fails or times out: system retries once, then falls back to a plain (un-personalized) version of the same structure rather than blocking the actor entirely

Postcondition (success): Exactly one ticket is active for this user, in `assigned` or `in_progress` state.

---

### UC-20: View Current Ticket

| Field | Detail |
|---|---|
| Actor | Logged-in user with an active ticket |
| Precondition | An active ticket exists |
| Trigger | Actor opens the ticket view |
| Linked FR | FR-32 |

Main flow:
1. Actor opens the ticket view
2. System shows the ticket's description, acceptance criteria, test checklist, and current state

Alternate / error flows:
- No active ticket: system redirects to UC-19 instead of showing an empty page

Postcondition (success): Actor sees the full current ticket.

---

### UC-21: Abandon Ticket

| Field | Detail |
|---|---|
| Actor | Logged-in user with an active ticket |
| Precondition | Ticket is `assigned` or `in_progress` (not already submitted) |
| Trigger | Actor clicks "abandon this ticket" |
| Linked FR | FR-35 |

Main flow:
1. Actor clicks abandon and confirms (a deliberate second step, not a single accidental click)
2. System marks the ticket abandoned (not counted as `done`, not shown in the experience profile as completed)
3. System immediately issues a new ticket (back to UC-19)

Alternate / error flows:
- Ticket already has a submission in progress (`submitted_v1` or later): abandon is not offered at this stage — the actor must finish the review cycle instead

Postcondition (success): Old ticket marked abandoned; a new ticket is active.

---

### UC-22: View Ticket History

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | Actor has at least one `done` ticket |
| Trigger | Actor opens their ticket history / experience profile |
| Linked FR | FR-36 |

Main flow:
1. Actor opens their history
2. System lists every completed ticket with its diff, feedback, and score

Alternate / error flows:
- No completed tickets yet: system shows an empty state pointing at the current active ticket, not an error

Postcondition (success): Actor sees an accurate list of completed work.

---

### UC-23: Ask Mentor a Question

| Field | Detail |
|---|---|
| Actor | Logged-in user with an `in_progress` ticket |
| Precondition | Ticket is `in_progress` |
| Trigger | Actor sends a message in the mentor chat |
| Linked FR | FR-37, FR-38, FR-41 |

Main flow:
1. Actor sends a question about their current ticket
2. System (Gemini) asks what the actor has already tried, if this is the first message on the topic
3. System gives a conceptual hint rather than a direct answer
4. If the actor asks again, system points to a relevant file/function
5. If the actor asks a third time on the same point, system gives a more specific suggestion

Alternate / error flows:
- Actor has hit the per-ticket message rate limit (FR-41): system shows a clear "you've reached the question limit for this ticket" message rather than silently dropping the message
- Ticket isn't `in_progress` (e.g. already submitted): mentor chat is read-only at this point, redirected to UC-24

Postcondition (success): Actor receives a hint appropriate to how many times they've asked about this specific point; message stored in the transcript.

---

### UC-24: View Mentor Conversation

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | A mentor conversation exists for a ticket (current or past) |
| Trigger | Actor opens the mentor chat panel for a given ticket |
| Linked FR | FR-39, FR-40 |

Main flow:
1. Actor opens the mentor panel for a ticket
2. System shows the full transcript for that ticket

Alternate / error flows:
- No messages sent yet for this ticket: system shows an empty chat, invites the actor to ask something

Postcondition (success): Actor sees the complete transcript for the ticket in question.

---

### UC-25: Submit Work (First Pass — Get Feedback)

| Field | Detail |
|---|---|
| Actor | Logged-in user with an `in_progress` ticket |
| Precondition | Ticket is `in_progress`; actor has pushed at least one commit to their repo |
| Trigger | Actor clicks "submit" |
| Linked FR | FR-42, FR-43, FR-44, FR-49 |

Main flow:
1. Actor clicks submit; system opens/reads the real PR/diff via the GitHub API
2. GitHub Actions runs the starter template's test suite on the pushed code
3. System waits for the CI result, then sends both the diff and the CI result to the evaluator (Groq)
4. Evaluator returns feedback only — explicitly no score at this stage
5. Ticket moves to `submitted_v1` (feedback given)

Alternate / error flows:
- CI or evaluator call times out or errors: system shows a clear retry option; the actor's submitted code/diff is not lost, they don't need to resubmit from scratch
- GitHub token invalid at submission time (FR-29): system prompts reconnect (UC-16) before retrying the submission

Postcondition (success): Ticket in `submitted_v1` state; actor has feedback, no score yet.

---

### UC-26: Resubmit Work (Second Pass — Get Final Score)

| Field | Detail |
|---|---|
| Actor | Logged-in user whose ticket is in `submitted_v1` (feedback given) |
| Precondition | Ticket is in `submitted_v1` |
| Trigger | Actor revises their code based on feedback and clicks "resubmit" |
| Linked FR | FR-45, FR-46, FR-47, FR-48, FR-49 |

Main flow:
1. Actor pushes revised commits and clicks resubmit
2. System reads the updated diff and re-runs CI, same as UC-25
3. Evaluator scores the resubmission against the fixed rubric (40% requirements met, 25% correctness & tests, 20% code quality, 15% problem-solving & communication evidence, using the mentor transcript from UC-23/24 as evidence for that last category)
4. System shows the full four-category breakdown, not just a total
5. Ticket moves to `done`
6. A new ticket is immediately available (back to UC-19)

Alternate / error flows:
- CI or evaluator call times out or errors: same retry handling as UC-25 — this is the final, one-time scoring pass, so the system must not silently lose this submission
- Actor tries to resubmit a second time after already being scored: blocked — for V1, the score is final once given, not iterative

Postcondition (success): Ticket `done`, scored, breakdown visible, next ticket unlocked.

---

### UC-27: View Experience Profile

| Field | Detail |
|---|---|
| Actor | Logged-in user |
| Precondition | None (works even with zero completed tickets) |
| Trigger | Actor opens their profile page |
| Linked FR | FR-50, FR-51 |

Main flow:
1. Actor opens their profile
2. System shows every completed ticket with diff, feedback, and rubric score, clearly labeled as a practice work-sample record — not a certified or employer-verified credential

Alternate / error flows:
- Zero completed tickets: system shows an empty state, not an error

Postcondition (success): Actor sees an accurate, honestly-labeled record of their completed work.

---

Next: proceed to → [4. Database & ER Diagram]
