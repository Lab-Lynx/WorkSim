# Security Policy

Work Simulator handles user accounts, GitHub OAuth tokens, payment webhooks and AI-generated feedback. We take reports about any of these seriously.

## Supported versions

Only the latest code on the `main` branch is supported. Fixes are made on `main` and deployed from there; we do not backport to older commits.

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

Report it privately through GitHub:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (GitHub private vulnerability reporting).
3. Describe the issue using the checklist below.

If the option is not visible to you, contact a maintainer listed in [`.github/CODEOWNERS`](.github/CODEOWNERS) directly and ask for a private channel. Do not post the details in a public place while you wait.

### What to include

- A clear description of the issue and its impact.
- The affected area (for example `backend/src/middlewares/auth.middleware.ts`, an API route, or a frontend page).
- Steps to reproduce, or a proof of concept.
- The commit, branch or deployed environment you tested against.
- Any suggested fix, if you have one.

Please use test accounts and your own data only. Do not access, modify or delete data that belongs to other users.

## What to expect

These are our targets, not contractual guarantees:

| Stage | Target |
| --- | --- |
| Acknowledge your report | within 3 business days |
| Initial assessment and severity | within 7 days |
| Fix or mitigation plan for confirmed issues | communicated as soon as the assessment is done |

We will keep you updated, credit you in the fix notes if you wish, and ask that you wait for a fix to ship before disclosing publicly.

## Scope

In scope:

- Authentication and session handling (httpOnly cookies, refresh token rotation, password reset, email verification).
- Authorization, including access to other users' tickets, submissions, subscriptions and profiles.
- Payment and webhook handling (Chapa signature verification, replay, idempotency).
- GitHub OAuth flow and stored GitHub tokens.
- Injection, XSS, CSRF, SSRF and CORS misconfiguration.
- Leakage of secrets, tokens or personal data in responses or logs.
- Abuse of AI endpoints that bypasses rate limits or exposes provider keys or prompts that should stay private.

Out of scope:

- Findings that need physical access to a user's device or an already-compromised account.
- Denial of service through sheer traffic volume.
- Missing best-practice headers or settings with no demonstrable impact.
- Vulnerabilities in third-party services (GitHub, Chapa, Resend, Gemini, Groq, hosting providers). Please report those to the vendor.
- Social engineering of maintainers or contributors.

## Handling secrets

If you discover a real secret (API key, token, connection string) in the repository, its history or a log, report it privately as above. Maintainers will rotate it first and then clean up the exposure.

Contributors must follow the secrets rules in [`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md): never commit real credentials, and use only the placeholder values in `.env.example`.

## Safe harbor

We will not pursue action against anyone who reports a vulnerability in good faith, follows this policy, avoids privacy violations and service disruption, and gives us reasonable time to respond before disclosure.
