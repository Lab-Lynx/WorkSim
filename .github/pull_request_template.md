## Summary

<!-- What does this PR do and why? One task per PR. -->

## Type of change

- [ ] `feat`: new functionality
- [ ] `fix`: bug fix
- [ ] `refactor`: no behaviour change
- [ ] `test`: tests only
- [ ] `docs`: documentation only
- [ ] `chore` / `ci`: tooling, dependencies, pipelines

## Area

- [ ] Backend
- [ ] Frontend
- [ ] Database / Prisma schema
- [ ] CI / deployment
- [ ] Docs

## Related issue or ticket

<!-- Closes #123 / n/a -->

## How was this tested?

<!-- Commands run, manual steps, screenshots or recordings for UI changes. -->

## Checklist

- [ ] The diff covers a single task; unrelated changes were left out
- [ ] Branch name follows `type/short-description` and commits follow Conventional Commits
- [ ] New files and functions have tests in this PR
- [ ] `npm run lint`, `npm run build` and `npm test` pass in every folder I changed
- [ ] No real secrets, tokens or connection strings in code, config, logs or the description
- [ ] No new `Authorization: Bearer` flow, token storage in the frontend, or controller-level database calls
- [ ] Documentation and `.env.example` are updated if behaviour or configuration changed

### If this changes the Prisma schema

- [ ] A migration is included (`npm run prisma:migrate`)
- [ ] Reviewer knows the migration must be applied to shared environments (it was not run against one from my machine)

### If this changes the UI

- [ ] Checked at mobile and desktop widths
- [ ] Keyboard navigation and accessible labels checked

## Notes for reviewers

<!-- Anything risky, deferred, or worth a closer look. Owners are requested automatically via CODEOWNERS. -->
