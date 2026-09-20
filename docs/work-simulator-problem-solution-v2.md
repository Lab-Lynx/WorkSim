Project: Work Simulator ("Your First Job Before You Get Your First Job") · Owner: Meseret · Status: Draft (v2 — post-feedback)
Team: R, T, F, K, M (5 people) · Timeline: 20 days, aiming to finish earlier where possible

---

## 1.1 Problem Statement

Junior developers finish school or a bootcamp knowing how to code, but they have never worked on a real team. They have never gotten a real ticket, talked to a mentor when stuck, pushed a real PR, or gotten real feedback on their work. Because of this gap, they cannot get a first job — and without a first job, they cannot get this experience. Coding challenge sites (LeetCode, HackerRank) do not fix this, because they only test isolated coding skill, not the full job experience: understanding a task, asking questions, writing real code in a real repo, and getting reviewed.

## 1.2 Target Users

| User type | Who they are | What they need from this system |
|---|---|---|
| Junior Developer | A self-taught or newly trained developer with some coding skill but no real work experience | Real tickets to work on, a mentor to ask questions to, a way to submit real code, and honest feedback and a final score |

## 1.3 Proposed Solution — overview

Work Simulator gives junior developers a place to practice being on a real team before they get their first job. This document now covers three versions on purpose, so the roadmap is visible to judges, teammates, and future us — not just the 20-day build.

| | **V1 — Hackathon build** | **V2 — Near-term** | **V3 — Long-term vision** |
|---|---|---|---|
| Timeline | This 20-day hackathon | First few months after | Beyond that |
| GitHub | Real OAuth + real repo + real PR, required (not a fallback) | Same, hardened | Same, hardened |
| Starter templates | React + Node/Express + Django | + more stacks | Many tracks, not just web |
| Ticket generation | Team-authored ticket **structure** (fields, required files, acceptance criteria, test checklist) filled in by AI — not freeform generation | Same system, more structures/categories | Same system, broader domains |
| AI roles | Mentor (progressive hints) + Evaluator (rubric-based, two-pass) | + QA teammate, + Engineering Manager teammate | + Design teammate, + DevOps/production tickets — the full simulated team |
| Scoring | Fixed rubric: 40% requirements met / 25% correctness & tests / 20% code quality / 15% problem-solving & communication evidence | Same rubric, richer evidence sources | Same rubric, validated against real hiring signal |
| Experience profile | Work-sample portfolio (ticket + diff + feedback + rubric) | Shareable public profile, pacing/scarcity mechanic (e.g. tickets released over time) | Researched, possibly employer-facing signal |

**V1 is a complete, working product on its own** — not a stripped demo of V2. Every V1 decision below is written to make V2 and V3 additive (new templates, new AI roles, new evidence sources) rather than requiring a rebuild. Where that matters, it's called out.

---

## 1.4 V1 — what we're actually building in 20 days

Work Simulator (V1) gives a junior developer one full, real loop: they register with email and password, verify their email, subscribe (Chapa), connect GitHub, get a real starter repo, work a real ticket with a mentor available, submit a real PR, get feedback, revise, and get a final score against a fixed rubric.

**The loop:**

1. User registers with name, email, and password (email + password account — not GitHub-OAuth-only). Successful registration logs them in (httpOnly access + refresh cookies) and sends a verification email.
2. User verifies their email. Verification is required before starting a subscription checkout.
3. User starts a monthly subscription via Chapa hosted checkout. Access is confirmed only by a verified Chapa webhook — not by the browser return URL alone.
4. User connects GitHub (real OAuth, scoped for repo create/push and repo hook registration) and creates a repo from a starter template.
5. Platform creates the starter repository in the user's GitHub account from the chosen template (React, Node/Express, or Django — see 1.4.3) and registers a `workflow_run` webhook on that repo.
6. User receives one ticket at a time. The ticket's **structure** is authored by the team (what fields it has, what files it touches, what "done" looks like, what the test checklist covers); Gemini fills in the specific wording and scenario within that structure. This is a real, live AI-generation feature — it just isn't freeform. See 1.4.1.
7. While working (including during the revision phase after first-submission feedback), the user can talk to an AI mentor. The mentor uses **progressive hints**, not direct answers:
   1. Asks what the user has already tried
   2. Gives a conceptual hint
   3. Points toward a relevant file or function
   4. Only gives a more specific suggestion if the user asks again
8. User pushes a real PR against their real repo (checked via the GitHub API). This is a hard requirement for V1, not an optional path — the team's call is that a real, functional GitHub flow is worth more in front of judges than a safer diff-paste fallback would be.
9. **First submission:** the AI evaluator checks the diff *and* the automated test results from GitHub Actions (not the diff alone — see 1.4.2) and gives feedback only. No score yet.
10. User updates their code based on that feedback and submits again.
11. **Re-review:** this is where the score is given, against the fixed rubric (see 1.4.4) — one time, final, for V1.
12. Once scored, the ticket is marked done and the next ticket opens.
13. Over time, this builds a work-sample profile: the ticket, the diff, the feedback, and the rubric breakdown — presented as a portfolio of practice, not a certified hiring credential.

### 1.4.1 Ticket generation — controlled structure, AI-filled content

This is the team's answer to "live generation is risky, but we want it as a real feature, not a demo trick." Instead of asking an AI to invent a ticket from nothing (which can reference files that don't exist, or be unclear/too large), the team defines the **shape** of a ticket up front — a fixed template with fields like: category, difficulty, which starter-template files it touches, acceptance criteria, and a test checklist skeleton. The AI's job is to fill that shape in with a specific, worded scenario, not to invent the shape itself.

This gets you a system that's genuinely generating tickets live (a real differentiator, and true to the original pitch) while keeping every generated ticket structurally guaranteed to be gradeable and reference real files — because the structure was never up to the AI in the first place.

*Scales to V2/V3 by adding more structures/categories to the same system — not by changing how generation works.*

### 1.4.2 Evaluation — diff + CI, not diff alone

The evaluator reads two things: the actual code diff, and the pass/fail result from a GitHub Actions run of the starter template's test suite (triggered automatically on push — no custom sandbox needed). This is the difference between "this code looks plausible" and "this code actually runs," and it mirrors what a real PR review looks like on a real team.

### 1.4.3 Starter templates

React, Node/Express, and Django are all V1 starter templates. The user picks one when creating their starter repository. Multi-track selection is therefore a real three-option choice in V1, not a two-option placeholder.

### 1.4.4 Scoring rubric (adopted, team-decided)

| Category | Weight | What it's scored from |
|---|---|---|
| Requirements met | 40% | Diff against the ticket's acceptance criteria |
| Correctness & tests | 25% | The diff + the GitHub Actions test result (1.4.2) |
| Code quality | 20% | The diff, read against normal review standards |
| Problem-solving & communication evidence | 15% | The mentor chat transcript for the ticket — did the user actually engage, ask real questions, work through the hints, rather than paste a finished answer with no back-and-forth |

That last category does double duty: it's also your cheapest anti-cheating signal, since it's the same transcript that shows whether the mentor was actually used as a mentor.

*Scales to V2/V3 by keeping this exact rubric as more roles (QA, EM) contribute additional evidence into the same four categories, rather than adding a second, different scoring system.*

### 1.4.5 What's explicitly out of V1 (see 1.5/1.6 for when)

- QA, Engineering Manager, Design, and DevOps AI roles
- Further starter templates beyond React, Node/Express, and Django
- **Voxide** (mandated external voice-command integration — see 1.5; not a V1 build task)
- A real pacing/scarcity mechanic (e.g. tickets-per-day limits) — build a simple counter if there's time, don't engineer a queue system for a hackathon
- Any claim that the experience profile is recognized by employers — this stays an open, untested assumption (see 1.7)
- A public/shareable profile page, streaks, or leaderboard — the "why come back a second time" hook. Worth one sentence in the pitch (see the feedback doc) but not V1 scope.

---

## 1.5 V2 — near-term, after the hackathon

V2 is additive on top of V1's architecture, not a rebuild.

**Mandated external integration (not a team wishlist item):**

- **Voxide** — a voice-command layer that lets any task in the product be triggered by voice. Built by the hackathon organizer and mandated for the project, but sequenced strictly **after V1 is complete**. It is not a V1 build task and not a stretch goal for the 20-day window. Treat it as an external integration requirement on the V2 calendar, distinct from the team's own optional V2/V3 ideas below.

**Team V2 additions:**

- **More starter templates** — further stacks beyond the V1 three (React, Node/Express, Django)
- **QA AI teammate** — reviews the same diff/CI evidence V1's evaluator already reads, adding a second, QA-flavored pass (edge cases, regressions) rather than a new pipeline
- **Engineering Manager AI teammate** — coordinates ticket flow, maybe sequences a small multi-ticket "sprint" instead of one ticket at a time
- **Real pacing mechanic** — the tickets-per-day idea from the original draft, built properly this time (creates scarcity, controls AI cost, gives the product a reason to bring someone back day after day)
- **Public-facing profile** — a shareable page, and the start of the "come back tomorrow" loop the V1 pitch is honest about not solving yet
- **Richer anti-cheat** — beyond the mentor-transcript signal already in the V1 rubric, e.g. a minimum engagement threshold before final submission is allowed

## 1.6 V3 — long-term vision

This is the original "full virtual team" ambition, revisited only once the V1 mentor/evaluator loop and the V2 QA/EM roles are proven and trusted:

- **Design AI teammate** and **DevOps/production tickets** — the last two roles from the original team structure
- **A fully simulated team**: mentor, evaluator, QA, EM, design, and DevOps all contributing to the same ticket lifecycle
- **Employer-facing signal, actually researched** — real conversations with people who hire juniors, not an assumed claim (this is the one item that's been "open" since the very first draft of this document, and stays open here)
- **Multiple career tracks beyond web development** — the natural extension once the ticket-structure system (1.4.1) already supports arbitrary categories

---

## 1.7 Assumptions & Open Questions

| # | Assumption / Question | Status |
|---|---|---|
| 1 | Employers will treat the experience profile as real signal when hiring | Still open — needs real research, not a V1 or V2 claim |
| 2 | The team-authored ticket-structure + AI-fill approach stays good quality and doesn't drift over time | Open — worth a spot-check partway through the 20 days |
| 3 | Django will be ready in time to ship as part of V1 rather than V2 | **Resolved** — Django is a full V1 starter template alongside React and Node/Express (see 1.4.3) |
| 4 | Checking a GitHub diff + GitHub Actions test result is enough proof of real work, without a full sandboxed execution environment | Resolved for V1 — this is the deliberate V1 answer (see 1.4.2); revisit if evaluator feedback feels untrustworthy in testing |
| 5 | QA, EM, Design, and DevOps roles can be added in V2/V3 without redesigning the V1 core loop | Resolved by design — see the "scales to" notes throughout 1.4; this is why V1 was built the way it was |
| 6 | GitHub OAuth + real PR flow is worth the added demo risk (vs. a diff-paste fallback) | Resolved — team decision: yes, judges evaluate on functional depth, so the real flow stays required for V1 |
| 7 | Voxide (mandated voice-command integration) timing | Resolved for sequencing — V2 after V1 is complete; not a V1 build task (see 1.5) |
