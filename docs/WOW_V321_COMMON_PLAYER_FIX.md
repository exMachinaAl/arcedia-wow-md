# WOW V3.2.1 — P0 Common-player Chat Identity Repair

## What failed

- `WA_ALLOWED_JIDS` with owner/admin JIDs blocked ordinary messages before the Chat Identity queue, and blocked normal players from running `.chatstyle on` in DM.
- Baileys may identify one participant as `@lid` in a group and by phone JID in a DM; opt-in keyed by one representation did not match the other.
- Lack of an equipped item was **not** a requirement. Default `✦ EXPLORER` is always shown in decorations.

## Safe changes

1. Only non-command *plain text* group messages and `.chatstyle` DM may bypass the old command allowlist. Core economy/admin/game commands remain restricted.
2. Alternate sender identity comes only from Baileys `participantAlt` or metadata matching the original group LID. No nickname matching or guessed telephone numbers.
3. SQLite stores original participant separately from account identity for correct mention and source-message revoke keys. Existing queued work remains valid.
4. Group admin `.wowchat diagnose` reports aggregate drop reasons (no message bodies or personal identifiers). No automatic ban or moderation.
5. Nothing automatically enables global/group/player consent, Replace or Delete.

## Minimal live test

1. In admin DM `.admin chat global on`.
2. In group (WhatsApp group admin) `.wowchat enable` then `.wowchat mode mirror`.
3. Common (non-admin) player DM `.chatstyle on`, `.chatstyle preview`; no badge or equipment necessary.
4. Common player sends one *ordinary text* message in group (not `.command`). After a few seconds a separate WOW Bot decorated message should appear, original remains.
5. Group admin sends `.wowchat diagnose` and inspects aggregated `no-consent`, `disabled`, or `player-rate` counts.
6. If still no reply, inspect gateway console `groups=on` and server/opt-in status; a message absent from Baileys events cannot be fixed by queue logic.

**Replace/Delete** remains PENDING LIVE. Keep `.admin chat replace off` and group `.wowchat mode mirror` until common-player baseline passes. `@lid` mapping can still fail if Baileys provides neither alternate JID nor a group metadata phone mapping; diagnose this separately rather than linking identities by guesswork.
