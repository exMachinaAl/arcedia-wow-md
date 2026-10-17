# WA-WORLD Offline Merge Protocol v1

Session: `GPT-6A29EB-20261016-B20C6A4DA9`.

## Purpose

Update existing WA-WORLD without GitHub, without copying source snippets, and without overwriting player data, WhatsApp credentials, `.env`, and local progress.

## How it works

Each release can include a standalone ZIP updater kit and a full starter ZIP. The kit includes the Node.js merge installer and its version-specific ZIP patch. Installation is offline, uses Node.js built-in modules, and **does not execute scripts embedded in the ZIP**.

Patch format (`patch.json` in ZIP root):

```json
{
  "format": 1,
  "project_id": "wa-world",
  "from_versions": ["0.1.0"],
  "to_version": "0.2.0",
  "files": [
    {"path": "src/file.js", "action": "replace", "base_sha256": "...", "sha256": "..."},
    {"path": "scripts/new.js", "action": "add", "sha256": "..."},
    {"path": "project/tracker.json", "action": "merge-tracker", "sha256": "..."}
  ]
}
```

Only archive payloads named `payload/<file path>` are accepted. SHA-256 verifies content integrity *against the manifest*, but **not publisher identity or authenticity**. Only install patches obtained from sources you trust. There is no remote automatic downloading.

### Safeguards

1. Preview validates package versions, patch manifest, filename safety, source-file SHA-256 and payload SHA-256 without modifying the project.
2. The installer refuses to overwrite locally modified source files. This is conflict detection, not a generic three-way text merge.
3. For `project/tracker.json` only, existing task status/notes are kept and missing new tasks/milestones are appended. The patch sets the new version.
4. Automatic backups of all modified source files are created under `.wa-world/backups/<id>` **before** modifying any project file.
5. Rollback checks files are unmodified since update before restoring; added files are removed.
6. `data/`, `.env*`, `.git/`, `node_modules/`, `.wa-world/`, `exports/`, and `updates/` are excluded from patch operations. The installer also rejects symlink targets.
7. User SQLite DB and WhatsApp session files are *not* touched. This does NOT replace separate database backups.
8. All files are staged with temporary filenames and individually renamed. Rollback attempts automatic restoration on install failures. This is not a fully atomic multi-file filesystem transaction.
9. Never run patch apply or rollback while dashboard or bot is running. Windows files can be locked and running services may use mixed versions.

### Windows kit install (for project v0.1.0)

1. Make sure Node.js >=22.16 is installed.
2. Stop the chat simulator, dashboard and Baileys bot.
3. Extract `WA-WORLD-Update-Kit-v0.2.0.zip` **next to** your existing `WA-WORLD-Starter` folder.
4. Double-click `01-PREVIEW-UPDATE.bat` from the extracted kit. It autodetects the sibling project folder; otherwise asks for the absolute directory.
5. Check for `No conflicts`, then run `02-INSTALL-UPDATE.bat`.
6. Run `npm test`, `npm run status`, then start dashboard; check Update History.
7. To revert before making additional edits, double-click `03-ROLLBACK-UPDATE.bat` from the kit. This reverts *code/tracker edits*, not player data.

### Future patches (project v0.2.0+)

Copy future `.zip` patches to `updates/incoming/`, then run `preview-update.bat` and `apply-update.bat` in the project root. These scripts select the most recently enumerated ZIP; you can also paste the path to a specific ZIP at the prompt. Roll back with `rollback-update.bat`.

For terminal control:

```powershell
node scripts/merge-updater.mjs preview "updates/incoming/PATCH-FILE.zip"
node scripts/merge-updater.mjs apply "updates/incoming/PATCH-FILE.zip"
node scripts/merge-updater.mjs history
node scripts/merge-updater.mjs rollback
```

### Share changes for the next release — no GitHub

Run `EXPORT-PROJECT.bat` (or `npm run project:export`). It builds a ZIP under `exports/` containing all source and tracker information but excludes `data/`, `.env`, auth, node_modules, backups and updates. Review the exported archive before sharing it with an assistant. Ask for the next **version-compatible ZIP patch** based on that export. The generated source snapshot is not a database backup.

### Limitations / future improvements

- No merge engine for arbitrary source-code edits: collisions stop rather than guessing which changes are correct.
- Requires compatible versions (`from_versions`) and a ZIP patch built against that source baseline.
- This release has **no database migrations**. Future schema changes need separate audited migration/backup protocol.
- Uses ZIP Store/Deflate reader with conservative size limits; ZIP64 and encrypted archives are intentionally unsupported.
- Backups can contain source code and configuration if future patches include such files: store backup directories privately.
- These scripts are a development-time installer, **not** a production-grade signed package manager.
