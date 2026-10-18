# Offline OneClick Upgrade to WA-WORLD v1.0.0

**Existing users:** Use the `WA-WORLD-OneClick-Upgrade-v1.0.0.zip` kit, not Full Project.
Direct targets: v0.5.0, v0.6.0, v0.7.0 (including Rescue updater), v0.8.0,
v0.8.1, v0.9.0. No chain install required.

1. Stop WhatsApp bot and dashboard, back up `data/` to a separate drive/folder.
2. Extract the kit to the same parent folder as `WA-WORLD-Starter`.
3. Run `INSTALL-WA-WORLD.bat` as admin ONLY if `C:\Program Files X` write
   permissions require it. Confirm the target path and version.
4. One Enter press after preview begins installation; automatic offline QA follows.
5. To roll back source, use `ROLLBACK-WA-WORLD.bat` from the same kit.

The kit uses a bundled external updater, never executes the installed updater to
apply a patch, allows official updater bootstrap differences after backup, and
never modifies `.env`, `data/`, `.git/`, `.wa-world/`, SQLite or WhatsApp secrets.
If app source was edited locally, a conflict aborts the entire update.

**Important:** rollback restores source only, not SQLite transactions after the
upgrade. WhatsApp buttons are not guaranteed to render in every client: test
three mandatory live checks separately.
