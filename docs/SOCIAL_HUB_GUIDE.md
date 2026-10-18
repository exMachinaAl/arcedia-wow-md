# WA-WORLD v0.7 — Social Hub: guide, privacy, risks

## Two-account quickstart (use two separate accounts with permission)

A: `.nick Alpha` / B: `.nick Beta`

A: `.friend add Beta`
B: `.friend inbox` then `.friend accept Alpha`
A: `.friend list` → Beta is displayed. No account number/JID is shown.

### Duel (optional live validation)
A: `.duel invite Beta` → copy UUID ID
B: `.duel inbox` then `.duel accept <ID>`
A: `.duel pick <ID> batu`
B: `.duel pick <ID> gunting`
Both: `.duel status <ID>`

The choices are hidden until both players pick. No V-Currency or financial stake is involved. Expiration: 10 minutes; each player can cancel. Pull-only invites: the bot does NOT automatically message the friend.

### V-Currency transfer (optional live validation)
A+B: `.pay enable` (disabled by default)
A: `.daily` to obtain some test V
A: `.pay Beta 1`
A+B: `.wallet`
A+B: `.pay disable` when finished

**Transfers are not purchases.** Both players must already be mutual friends and must opt in. Transfers cannot be reversed within this prototype, so start with 1 V. Max 50 V/transaction and 100 V/sender/day (WIB). No top-up, no withdrawal, no cash redemption, no roulette, no betting.

### Privacy and safety
- `.friend block Nick` blocks interactions and removes friendship. `.friend unblock Nick` permits a new request, not an automatic reconnection.
- `.friend remove Nick` ends relationship. Declined friend request gets 24h cooldown on re-request.
- Nicknames are unique case-insensitively; raw sender IDs are never shown in social outputs or dashboards.
- Social features are private chat only even if general group commands are enabled.
- Bot does not send unsolicited friend requests, invites, reminders, or payments.
- Moderation/reconciliation/outbox/scalable DB are still incomplete. Avoid broad public access and use test V-Currency only.

## QA mandatory
1. `LIVE_PAIR`: WA-START connected.
2. `LIVE_ROUNDTRIP`: second account receives `.menu` response.
3. `LIVE_SOCIAL`: social button displays and friend request from A is accepted by B.

Optional: `LIVE_DUEL`, `LIVE_TRANSFER`, `LIVE_RECONNECT`, `LIVE_AI`.
The offline QA test only checks code, never real WhatsApp UI rendering.
