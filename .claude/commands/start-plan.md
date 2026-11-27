---
description: Set up the branch for a plan (from its GitHub issue), commit the plan there, then start work
argument-hint: <plan number, e.g. 0003>
---
Start work on plan $ARGUMENTS (`docs/plans/$ARGUMENTS-*.md`). Do the git setup below first and implement nothing until it is done.

1. Read the plan. Note its **GitHub issue** (`#123` or `none`) and its slug (the file name without `NNNN-` and `.md`).
2. Branch name:
   - with an issue: `<issue>-<slug>`, e.g. `123-migrate-server-to-nestjs`
   - without one: `plan-<NNNN>-<slug>`, e.g. `plan-0003-add-auth`
3. If the plan already names a **Branch** and it exists (locally or on `origin`), this is a resumed plan: `git switch <branch>` (and `git pull`), then skip to step 7.
4. Check the working tree. Only the plan file (and the index row in `docs/plans/README.md`) may be uncommitted. If anything else is changed, stop and ask me what to do with it.
5. Create the branch from an up-to-date `main`:
   - `git switch main && git pull --ff-only` (uncommitted plan files come along)
   - `git switch -c <branch>`
   - `git push -u origin <branch>`
6. Write the branch name into the plan's **Branch** field, set Status to `in-progress`, then commit only the plan file and `docs/plans/README.md`:
   `Add plan NNNN: <title> (#<issue>)` (leave out `(#<issue>)` when there is none), and `git push`.
7. Tell me the branch name in one line, then start task 1.

While working on the plan: do **not** commit or push the work until I explicitly say to commit. When I do, commit on this branch, reference the issue in the message (`(#123)`), and push. Never commit plan work to `main`.
