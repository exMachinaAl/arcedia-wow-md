# QA playbook — v0.7.0

Automated: run `QA-ONE-CLICK.bat` then open `http://127.0.0.1:3000`. It labels AUTO tests WAJIB; LIVE state is PENDING_LIVE until your manual confirmation. It does not inherit PASS from any previous release.

## Only three LIVE tests marked WAJIB
1. `LIVE_PAIR`: WA-START connects without exposing QR/token.
2. `LIVE_ROUNDTRIP`: from a secondary phone, `.menu` responds.
3. `LIVE_SOCIAL`: both accounts `.nick`, then A `.friend add NickB`, B `.friend inbox` / `.friend accept NickA`. `.social` and Friends native buttons should render.

## Optional
- `LIVE_DUEL`: friend-only no-wager duel with two accounts.
- `LIVE_TRANSFER`: both `.pay enable`, send just 1 V and verify balances.
- `LIVE_RECONNECT`: restart WA-START.
- `LIVE_AI`: if Ollama installed, send `.ai ask` with consent.

Use `QA-LIVE-RECORD.bat` to mark PASS/FAIL manually with non-sensitive notes, or leave pending. Don't mark rendered on device from successful relay alone.

# WA-WORLD v0.6.0 — QA Flags

## Automated (already run by builder)

The Node.js test suite covers game engine, SQLite idempotency, V-Currency reward cap, sessions, the WhatsApp native button routing payload, Game Pack 02, optional Ollama adapter, JSON schema, local-only AI URLs, user consent, rate limits, duplicate events, and error fallback.

Run `QA-ONE-CLICK.bat` after installing the patch, or `npm run qa`. It updates local `data/qa-report.json` and the dashboard http://127.0.0.1:3000.

**Offline PASS is not WhatsApp verified.** `LIVE` is recorded from human testing on your own devices only.

## WAJIB LIVE — just 3 quick checks

1. `LIVE_PAIR`: with bot started using `WA-START.bat`, see **connected**. If session was previously linked, no need to scan a new QR.
2. `LIVE_ROUNDTRIP`: a second consenting account sends `.menu`, receives reply.
3. `LIVE_BUTTON`: tap `.menu` -> Games -> Koin, then a choice. A losing play does not necessarily give a reward, so verify **response arrives** instead of expecting wallet balance to rise every time.

Use `QA-LIVE-RECORD.bat` and enter `P/F/S`. The 0.6 report stores your reports in `data/qa-live-results-0.6.0.json`; existing 0.5 reports cannot mark this version as passed.

## OPSIONAL LIVE

- `.packs` → Next → Numbers → Biner; `.packs2` may not render consistently on all clients.
- `.ai help`, `.ai consent`, `.ai ask`, `.ai json`, `.ai off`: only when local Ollama has been installed, model pulled, and `WA_AI_ENABLED=1`.
- Reconnect, iOS/Web, groups (disabled by default), older Game Packs.

## QA status meanings

- `PASS`: automated suite passed, or operator reported a live success.
- `FAIL`: automated suite failed, or operator reported live failure.
- `PENDING_LIVE`: no human result for this release. This is NOT a bug, not PASS.
- `WAJIB`: required before claiming live deployment verified.
- `OPSIONAL`: can be postponed without preventing basic smoke-test acceptance.

Do not send credentials, QR, stored sessions, or WhatsApp personal numbers for debugging. When sharing errors, redact sensitive identifiers.
