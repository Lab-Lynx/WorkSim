# Team & AI Usage Guidelines — Work Simulator
These are not suggestions. Follow them. If something here is blocking you, raise it with M — don't quietly skip it.

---

## 1. Prompting rules

**Rule: one prompt, one task.** Never ask an AI to "build the whole ticket system" or "make the whole dashboard." That is exactly how output gets messy, inconsistent, and hard to review — the AI fills in gaps with its own guesses instead of yours. Scope every prompt to one file, or a small, named set of files, with a clear boundary of what it may and may not touch.

**Bad prompt:**
> "Build the ticket assignment feature."

**Good prompt:**
> "In `services/ticketService.ts` only, add a function `assignNextTicket(userId)` that: finds the next unassigned ticket for the user's active project, marks it `in_progress`, and returns it. Don't touch any other file. Include a unit test for it in the same response, using the existing test pattern in `services/ticketService.test.ts`."

**Good prompt, for a review task (Claude):**
> "Here is my diff for the ticket-assignment endpoint [paste diff]. Check it against these three things only: (1) does it handle the case where no ticket is available, (2) is the DB query in the right layer, (3) are there any obvious security issues with how `userId` is trusted. Don't suggest style changes."

**Good prompt, for UI generation (v0):**
> "Build a React card component for a single coding ticket: title, difficulty badge, short description, a 'Start' button. Match this color palette: [paste tokens from Figma]. No extra features — just this card."

**Bad prompt, for Cursor:**
> "Fix everything in this file."

**Good prompt, for Cursor:**
> "In this file, the `submitDiff` function throws when the diff is empty. Fix only that null case. Don't refactor anything else in this file."

If a task genuinely needs multiple steps, give the AI multiple prompts, one after another, checking the output between each — not one giant prompt that tries to do it all.

**Claude usage specifically:** since Claude is your team's default for architecture, review, and debugging, always give it the actual context it needs (the relevant file, the actual error, the actual schema) rather than describing things from memory. A vague description gets a vague, guessed answer.

---

## 2. Every AI output is reviewed by a human before it's committed

No one pastes AI-generated code straight into a commit without reading every line. This applies whether it came from Copilot, Cursor, v0, or Antigravity. You are responsible for code with your name on the commit — "the AI wrote it" is not a defense if it breaks something or leaks a secret.

If an AI's answer looks off, don't just re-prompt it and hope — cross-check with a second tool (e.g., ask Claude if Cursor's suggestion looks right) or ask a teammate. This matters most for anything touching security, the DB layer, or the scoring rubric — the parts where a confidently-wrong answer is expensive to catch late.

---

## 3. Secrets — zero tolerance

- **Never** paste `.env` values, API keys, tokens, DB connection strings, or real credentials into *any* AI chat — including Claude and ChatGPT. Use fake placeholder values when you need to show an AI the shape of a config.
- Real secrets live only in `.env`, which is in `.gitignore` from day 1. Commit `.env.example` with placeholder values instead, so teammates know what variables exist without ever seeing real values.
- Husky's pre-commit hook should block commits that contain obvious secret patterns (API keys, tokens) — set this up on day 1, not after something leaks.
- Enable GitHub's built-in secret scanning on the repo.
- If a secret is ever committed by accident: rotate it immediately (assume it's compromised the moment it hits GitHub, even on a private repo, even if you delete the commit right after) — don't just remove the line and move on.
- Be extra careful with GitHub tokens specifically, since this product stores user OAuth tokens: request the minimum scope needed (repo create/push, nothing broader), never log a raw token anywhere, including your own debug output.

---

## 4. Testing and CI — non-negotiable

- Every file you write gets a test in the **same PR**, not a follow-up "I'll add tests later" PR. Later doesn't happen during a hackathon.
- Husky blocks any commit where local tests fail. Don't work around it, don't `--no-verify` your way past it.
- CI must be green before you request a review. A red pipeline with "will fix in review" attached wastes the reviewer's time.
- No merge to `main` without at least 1 approval — branch protection enforces this, so don't ask someone to bypass it "just this once."

---

## 5. Git conventions

**Branch naming:** `type/short-description`
Examples: `feat/ticket-assignment`, `fix/mentor-chat-scroll`, `chore/ci-setup`, `docs/architecture-v1`

**Commit messages:** Conventional Commits style — `type: short imperative description`
Examples: `feat: add ticket assignment service`, `fix: handle empty diff on submit`, `test: add coverage for evaluator scoring`

**PRs:**
- Link the issue it closes (`Closes #12`)
- Describe *what* changed and *why*, not just "updates"
- Keep PRs small and scoped to one task — same rule as prompting: one task, one PR. A giant PR is hard to review honestly, which defeats the point of requiring review at all.

---

## 6. Code quality rules

- Follow the layering from the roles/plan doc: **route → controller → service → repo**. No DB queries in controllers. No business logic in routes.
- Write code as if another version of this product will be built on top of it later, because you said yourselves you might extend it if you finish early — that means: no hardcoded values that should be config, no copy-pasted logic across files, name things the way you'd want to read them in a rush at 2am during the demo.
- If you're touching a file someone else owns per the roles doc, ping them first — don't silently change another lane's code.

---

## 7. Deadlines and communication

- When you pick up a task, say out loud (in your tracking tool or team channel) what "done" means for it *before* you start — this avoids the "I thought done meant X" conversation later.
- Flag a blocker the moment you hit it — same day, not at the next standup. A blocker sitting quiet for a day is a lost day for the whole team, not just you.
- Respect the deadlines in the day-by-day plan. If you're going to miss one, say so as early as possible so the plan can shift — silence is worse than bad news.

---

## 8. Privacy and tool boundaries

- Public/free-tier AI tools may use what you paste as training data depending on their settings — check before pasting anything sensitive (this mostly matters for real user data later, but build the habit now).
- LangChain + local Ollama is your private, offline option — use it specifically when prototyping the mentor/evaluator prompts on real ticket/code examples you don't want leaving your machine.
- Antigravity and other agentic tools that can read your **whole repo** are powerful, but that also means they see everything in it — don't point a full-repo-context tool at a repo that still has real secrets sitting in it by mistake (see Section 3 — it shouldn't, but double-check).

---

## 9. Quick reference — who to ask, what for

| Question | Ask |
|---|---|
| "Which layer does this logic belong in?" | M |
| "Is this AI code safe to merge?" | Whoever reviews your PR — don't self-merge |
| "Can I use tool X for task Y?" | Check Section 2 of the roles/plan doc first, then ask M if it's not listed |
| "I think I found a secret in the repo" | M, immediately, not in the group chat — rotate it first, discuss after |
