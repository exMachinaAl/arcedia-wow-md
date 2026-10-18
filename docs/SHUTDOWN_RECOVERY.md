# Server shutdown and upgrade policy (v1.4)

Before installing any patch:
1. Stop WhatsApp gateway with Ctrl+C in `WA-START.bat` terminal (do not use Task Manager End Task if avoidable).
2. Stop dashboard (its own terminal Ctrl+C).
3. Copy `data/` including `world.sqlite`, `world.sqlite-wal` and `world.sqlite-shm` if present while both processes are stopped; include `data/wa-auth` but never upload it to chats.
4. Run OneClick installer and inspect preview; it must identify v1.3.1 as source.
5. Start WA-START again. The runtime guard pauses pending TTLs during downtime and flushes unsent notifications.

A normal process restart is **not** data migration. Old SQLite data is preserved; new tables are created with IF NOT EXISTS.

The app is designed for one gateway process per database. If it reports "Gateway already running", stop the old gateway or wait for the stale lease to expire (typically <=25 seconds after an abrupt process crash). Do not alter the DB directly to force multiple gateways.

Rollback of source files **does not reverse database changes**. For a complete downgrade, restore a separate pre-upgrade backup of data/ from a stopped server. If no backup is available, keep the new version rather than attempting an unsafe database downgrade.

**First-upgrade boundary:** v1.3.1 did not write a runtime heartbeat. Its existing matches are persisted, but v1.4 cannot accurately estimate downtime **before the first v1.4 gateway launch**; thereafter v1.4 tracks downtime and pauses pending TTLs.
