# Work Simulator — Decisions Log

Not part of the numbered doc series (1–11). One row per team decision applied after the docs audit. The "why" lives here so the series docs stay free of audit meta-commentary.

| ID | Decision (one line) | Doc(s) changed |
|---|---|---|
| D-01 | Email verification blocks starting checkout (Q-04 closed; Doc 6 A-39 corrected) | 2, 3, 4, 5, 6, 8, 9, 10 |
| D-02 | No un-cancel / no `canceling` status; cancel → `canceled` immediately; re-subscribe via EP-13 after lapse | 3 |
| D-03 | No grace period; access ends at `currentPeriodEnd` (Q-07 closed on same basis as Q-01) | 5 |
| D-04 | Mentor available during `submitted_v1` revision phase (Q-10c closed) | 2, 5, 6, 8, 9, 10, 11 |
| D-05 | Django is a full V1 starter template alongside React and Node/Express | 1, 2, 4, 5, 6, 7, 8, 9, 10 |
| D-06 | Ticket-content generation uses Gemini (confirmed; remove "assumed" hedges) | 2, 8 |
| D-07 | Voxide = mandated external voice-command layer, sequenced after V1 (V2), not a V1 build task | 1, 2, 4, 5, 6, 7 |
| D-08 | Chapa renewals are platform-triggered (7-day reminder + charge at period end); `renewalReminderSentAt`; Q-05 ref half stays open | 4, 5, 7, 8, 9 |
| D-09 | GitHub scope includes `write:repo_hook`; register `workflow_run` webhook in EP-22 after repo create (Q-08 closed) | 2, 5, 8, 9 |
| D-10 | Registration logs the user in (matches built auth + UC-01); EP-01 was wrong | 5, 6, 10, 11 |
| D-11 | Already-used verification link → soft "already verified" 200, not 410 (UC-02 correct) | 5, 6, 8, 9, 10 |
| D-12 | Password reset revokes all other active sessions (Q-11 closed; UC-05 correct) | 5, 8, 9 |
| D-13 | Repo name collision → 409 only, no auto-suffix (UC-18 corrected to match EP-22) | 3 |
| D-14 | No AI fallback ticket content on Gemini failure — hard-fail/retry (UC-19 corrected) | 3 |
| D-15 | Mentor replies are single JSON, not streaming (NFR wording fixed) | 2 |
| D-16 | Doc 8 file/module names win; Doc 7 rewritten to match; serializers folder named; payment.controller test added | 7, 8, 9 |
| D-17 | Env var is `CLIENT_URL`, not `FRONTEND_URL` | 7, 10 |
| D-18 | Doc 7 §7.1.1 filenames match real repo files | 7 |
| D-19 | FR-33 printed state machine drops `scored`; score on Evaluation | 2 |
| D-20 | Frontend FLS = Doc 10, frontend test plan = Doc 11 (headers + citations) | 6, 7, 10, 11 |
| D-21 | Replace Linked Use Case placeholders with real UC-## IDs | 2, 5, 6 |
| D-22 | UC-19 main flow gets explicit "Start working" / EP-26 step | 3, 5 |
| D-23 | Fix wrong EP numbers on frontend hooks in Doc 11 (and Doc 10 if present) | 10, 11 |
| D-24 | Abandon dialog copy: marked abandoned, not "reset" | 6 |
| D-25 | DB↔API score field rename is intentional serializer mapping; add mapping test | 4, 5, 9 |
| D-26 | Doc 2 prose uses enum value `past_due` | 2 |
| D-27 | Add Doc 10's ten proposed frontend helper files to Doc 7 | 7 |
| D-28 | FR-15 lists full "+ Sub" gate matching Doc 5 | 2 |
| D-29 | WCAG 2.1 AA is design target, not blocking V1 ship gate | 6 |
| D-30 | Doc 1 §1.4 V1 loop opens with email+password, verification, GitHub, then subscription | 1 |
| D-31 | FR-33 needs no dedicated UC beyond UC-19 / UC-25 / UC-26 (via D-22) | 3 |
| D-32 | Add `payment.controller.test.ts` (Doc 9) and individual auth-hook rows (Doc 11 §9.1) | 9, 11 |
| D-33 | Doc 9 notes real Postgres required for integration tests; CI workflow gap flagged for team | 9 |
