---
description: Create the next numbered plan from the template
argument-hint: <short title> [#issue]
---
Create a new plan titled "$ARGUMENTS".

1. Look at `docs/plans/` and `docs/plans/archive/` to find the highest existing number and use the next one (4 digits).
2. Copy `docs/plans/_template.md` to `docs/plans/NNNN-<kebab-slug>.md`.
   - **GitHub issue:** use the `#number` from the arguments if given, otherwise ask me ("none" is a valid answer). If there is one, check it with `gh issue view <n>` and use its title and body as input for the plan.
3. Fill in Goal, Context, Scope and the Tasks checklist (vertical slices). Ask me if the scope is unclear.
4. Add a row to the index in `docs/plans/README.md` with status `proposed`.
5. Do not commit the plan and do not create a branch: `/start-plan NNNN` does that when work begins.
6. Do not start implementing; stop and wait for approval.
