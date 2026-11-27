# Plans

One plan = one unit of work, executed in its own session.

## Workflow
1. **Plan:** copy `_template.md` to `NNNN-short-slug.md` (or run `/new-plan <title>`), fill it in (the **Tasks** checklist comes first), set status `proposed` and the **GitHub issue** (`#123` or `none`), review/approve. The plan is not committed yet.
2. **Execute:** start a fresh session and run `/start-plan NNNN`. It creates and pushes the branch (`<issue>-<slug>`, or `plan-NNNN-<slug>` without an issue), commits the plan on it, then starts work. Read only that plan plus what it references. Plan work never happens on `main`; small changes outside a plan may.
3. **Track:** tick each task `[x]` as soon as it is done and verified, and set Status to `in-progress` while working.
4. **Close:** set Status to `done` and fill in **Outcome** (deviations, decisions, follow-ups). Update the index below.
5. **Archive:** move the finished plan to `archive/` (`git mv`) and point its index link there. Numbers are never reused. Then offer to open a pull request for the branch (`Closes #123` when there is an issue).

Keep plans small enough to finish in one session. If a plan grows, split it.
Tasks are vertical slices: each delivers something working end to end (UI → API → DB), not a single layer.

## Index
| # | Plan | Status |
|---|------|--------|
| 0001 | [Project setup](0001-project-setup.md) | proposed |
| 0002 | [Migrate server to NestJS](archive/0002-migrate-server-to-nestjs.md) | archived |
