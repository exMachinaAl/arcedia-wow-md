# WA-WORLD OneClick Installer v3 — Bootstrap-safe merge policy

**Why this exists:** a Rescue Installer changed `scripts/merge-updater.mjs` while leaving the app version `0.7.0`. Future SHA-only comparisons misclassified official rescue changes as user edits. The updater used by the NEW installer is bundled separately, and never executed from the existing project.

## Conflict matrix

| Target path | Policy |
|---|---|
| `scripts/merge-updater.mjs` ONLY | Managed bootstrap. Warn, fully back up old bytes and replace after Enter confirmation; can rollback. |
| `README.md`, `CHANGELOG.md`, `docs/*.md` | Back up original if changed; replace with release docs. |
| `src/*.js`, `src/**/*.js`, `package.json`, executable BAT and other code | Strict SHA match; halt safely on unexpected differences. |
| `project/tracker.json` | Merge existing progress with missing official tasks. |
| `data/`, `.env*`, `node_modules/`, `.wa-world/`, SQLite and WhatsApp auth | Never included in patch and never replaced. |

## Safety rules

- Preview is read-only; NO project files touched when conflicts are found.
- Apply backs up all replaced files under `.wa-world/backups/<id>/original/` before writing.
- Patch integrity uses SHA-256 checksums, **not publisher authentication**. Only use package received from a trusted source.
- Rollback source restores backed-up files, but does not revert database mutations after an upgrade.
- Exit code nonzero on failures, do not mark WA live tests PASS automatically.
- Future releases must test `v0.7.0 + Rescue-updater` alongside original official versions to avoid regression.
- Use a backup of `data/` outside the project before upgrade. Stop gateway/dashboard. Run as admin only when filesystem permission requires it.
