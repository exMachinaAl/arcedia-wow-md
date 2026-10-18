# OneClick Offline Upgrade v0.9.0
- Stop bot and dashboard. Manually copy `data/` to a separate safe folder.
- Extract `WA-WORLD-OneClick-Upgrade-v0.9.0.zip` next to the existing `WA-WORLD-Starter` folder.
- Run `INSTALL-WA-WORLD.bat` (as administrator only if directory permissions require it), check the displayed target and version, then press Enter once.
- The kit supports source v0.5, v0.6, v0.7 including prior Rescue updater, v0.8.0 and v0.8.1. No chain patches.
- Docs and the exact managed updater file are fully backed up before overwrite; changed application source blocks entire update.
- `.wa-world/backups/` contains rollback source files. SQLite and WA session are not overwritten. DB changes after upgrade cannot be rolled back by source rollback.
- Run `QA-ONE-CLICK.bat` and subsequently test WA `.menu` and `.packs4` on your paired number.
- An offline test result is not proof of compatibility with your specific Windows installation or WhatsApp app version.
