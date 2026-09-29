# Two machines: keeping the desktop and the MacBook in step

Since 2026-09-29 the owner works on gcdatlas from two computers:

| Machine | Folder | Notes |
| --- | --- | --- |
| Windows desktop (home, the main one) | `C:\Users\eshin\Desktop\Claude Code\gcdAtlas` | Had local changes that were not pushed when the MacBook sessions started. |
| MacBook | `/Users/gcd/Documents/Claude Code/gcdAtlas` | Cloned fresh from GitHub on 2026-09-29. |

GitHub (`eshin087/gcdatlas`) is the only place they meet. Nothing is copied between the machines by hand.

## The check at the start of every session

`.claude/settings.json` runs `node tools/sync-check.mjs` when Claude Code starts, resumes or compacts in this folder. It fetches from GitHub and reports:

- how far this branch and `main` are behind GitHub,
- uncommitted files on this machine,
- every branch on GitHub not merged into `main` (open PRs first), and which of their files you have also changed here.

It only reads. It never pulls, merges, stashes or switches branches. **Claude: tell the owner what the report says before editing anything, and integrate only when the owner says so.** Run it by hand at any time with `node tools/sync-check.mjs`.

## Rules for both machines

1. **Fetch first.** The hook does it; read its report before touching files.
2. **Never force-push, rebase or rewrite a branch that is on GitHub.** The other machine may have it checked out.
3. **Push before you leave a machine**, unfinished work too (on a `wip/...` branch), so the other one can see it.
4. **Version numbers:** before naming `release/vX.Y.Z`, run `gh pr list` and take the next number nobody uses. The other machine may already have taken one.
5. **Stacked branches:** when new work touches the same files as an open PR, branch from that PR's branch and open the PR against it. When the base PR is merged with `--delete-branch`, GitHub moves the stacked PR onto `main` by itself.
6. Rule zero in `CLAUDE.md` still holds on both machines: merge only the owner's PRs, only when the owner says so.

## Bringing a machine up to date when it has local changes

The safest way keeps the local work on a branch of its own first, so nothing can be lost:

```
git fetch --all --prune
git switch -c wip/desktop-2026-09-29
git add -A
git commit -m "WIP from the desktop"
git switch main
git pull --ff-only
```

Then, with the owner, decide where the WIP goes: onto the newest release branch (`git switch release/vX.Y.Z && git merge wip/desktop-2026-09-29`), or into a new release branch made from the newest one. Resolve conflicts file by file, build (`node build.mjs`) and run `npm test` before pushing.

If the owner wants the quick way instead: `git stash push -u -m "desktop wip"`, `git pull --ff-only`, `git stash pop`.

## Work done on the MacBook (newest first)

The sync check always shows the live state; this table says what each branch is for.

| Date | Branch (PR) | What | Main files |
| --- | --- | --- | --- |
| 2026-09-29 | `release/v0.9.6` (PR #32, stacked on `release/v0.9.4` / PR #30) | The Halo: riding along from far away no longer loses the ship; a ride camera that keeps the place being visited in view and moves between shots (with a still option, K); the Halo tour (a button beside play) that flies the chosen tour's stops; the angle line under the name in the screensaver | new: `src/08r-ride.js`, `src/09t-halotour.js`; changed: `src/08-camera.js`, `src/09-render.js`, `src/09f-features.js`, `src/04-world.js`, `src/00-head.html`, `src/01-body.html`, `tests/motion.mjs`, `tests/mobile.mjs`, `package.json`, `CLAUDE.md`, `docs/CHANGELOG.md`, `docs/PATCHNOTES.md`, `docs/HANDOFF.md`, `docs/ACCURACY.md`, `docs/TESTING.md` |
| 2026-09-29 | `docs/two-machine-sync` (PR #31) | This file, the session-start check (`tools/sync-check.mjs`, `.claude/settings.json`) and a pointer at the top of `CLAUDE.md` | docs only |

## When the desktop comes back

1. Start Claude Code in the folder. If the hook is not there yet (this file is new), say: *"Fetch from GitHub, read docs/SYNC.md on origin/main, and tell me what changed before touching anything."* (`git show origin/main:docs/SYNC.md` reads it without changing any file.)
2. Keep the desktop's own changes safe on a `wip/` branch (above).
3. Look at the open PRs: the MacBook's work is stacked on `release/v0.9.4`. If the desktop's changes also touch the Halo, the camera or the interface, fold them in on top of the newest of those branches, not on `main`.
