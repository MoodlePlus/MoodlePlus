# Contributing to Moodle+

Thanks for helping build Moodle+! This doc covers our team's Git workflow.

## Workflow

1. **Branch off `main`** for every change — no direct commits to `main`.
   - Use descriptive branch names, e.g. `unity_id/grade-calculator`, `fix/dark-mode-popup`.
2. **Open a pull request** when your change is ready for review.
   - Keep PRs focused and reasonably small.
   - Describe what changed and why in the PR description.
3. **At least one reviewer** must approve before merging.
4. **Squash-merge** into `main` once approved — keeps history clean with one commit per feature/fix.
5. Delete your branch after it's merged.

## Before opening a PR

```bash
npm install
npm run lint
npm run test
npm run build
```

Make sure all of the above pass/compile cleanly.

## Commit messages

Keep them short and descriptive. Since we squash-merge, the PR title becomes the commit message on `main` — make it count.
