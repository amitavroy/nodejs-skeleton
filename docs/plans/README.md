# Plans

One plan = one unit of work, executed in its own session.

## Workflow
1. **Plan:** copy `_template.md` to `NNNN-short-slug.md` (or run `/new-plan <title>`), fill it in (the **Tasks** checklist comes first), set status `proposed`, review/approve.
2. **Execute:** start a fresh session: "Execute docs/plans/NNNN-….md". Read only that plan plus what it references.
3. **Track:** tick each task `[x]` as soon as it is done and verified, and set Status to `in-progress` while working.
4. **Close:** set Status to `done` and fill in **Outcome** (deviations, decisions, follow-ups). Update the index below.
5. **Archive:** move the finished plan to `archive/` (`git mv`) and point its index link there. Numbers are never reused.

Keep plans small enough to finish in one session. If a plan grows, split it.
Tasks are vertical slices: each delivers something working end to end (UI → API → DB), not a single layer.

## Index
| # | Plan | Status |
|---|------|--------|
| 0001 | [Project setup](0001-project-setup.md) | proposed |
| 0002 | [Migrate server to NestJS](archive/0002-migrate-server-to-nestjs.md) | archived |
