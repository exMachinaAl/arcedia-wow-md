# WA-WORLD v1.4 — Blackjack Social Table (Free / Non-wagering)

## Scope
- 1–4 players versus a dealer, four shuffled card decks per room, ACE soft/hard 17 rules (dealer stands on any 17), natural blackjack and pushes.
- No staking, betting, payout, virtual-currency transfer, top-up, exchange, or prizes of real-world value.
- Self-hosted engine stores room, shoe, cards, actions, results and outgoing notices in SQLite.
- Group shows only public lobby/dealer progress; private hands and Hit/Stand stay in DM. Group support requires `WA_ENABLE_GROUPS=true` and consenting members.
- DM identity and group participant JID can differ under WhatsApp LID; group tables use a shared invitation code and assign the first private-joining participant as host. Group-originator and DM host are not assumed identical.

## Commands
Private chats: `.bj help`, `.bj create`, `.bj join CODE`, `.bj start`, `.bj status`, `.bj hand`, `.bj hit`, `.bj stand`, `.bj leave` (lobby only).

Groups (if group mode opted in): `.bj group`, `.bj board CODE`. No player cards, hits, or stands in group.

### Quick walkthrough
1. Host: `.bj create` in private chat, share the 8-char room code.
2. Friend: `.bj join CODE` in private chat.
3. Host: `.bj start`. Each player receives a private notification showing their cards; use `.bj hand` for PNG.
4. Players use `.bj hit` or `.bj stand` in DM, in any order.
5. Once all hands settle, server reveals dealer cards privately, records win/lose/push without paying credits.

To open a group-linked table, use `.bj group` in an allowed group; members join via DM with `.bj join CODE`. The first DM joiner acts as host.

## Shutdown and resume
- Each successful action is committed atomically to the SQLite WAL database before sending the WhatsApp response.
- Shoe, player hands, match status and the outgoing notification queue persist across restart. No re-deal and no replay of an action that has the same incoming message ID.
- Gateway lease blocks a second simultaneous gateway against the same SQLite DB.
- A periodic heartbeat and STOPPED marker help estimate offline duration. Pending matchmaking and live match expiry timestamps are extended by that duration when the gateway restarts.
- Notifications are **at-least-once**, not exactly once; sudden disconnections can cause duplicate *messages* but must not duplicate game actions.
- Termination signals wait up to 10 seconds for in-flight messages. Abrupt termination still relies on DB transactions and outbox recovery; do not hard-power-off during a database backup.
- `.env`, `data/`, and linked WhatsApp auth state are not part of the installer payload.

## Known limitations
- Dealer game has no betting, split, double down, insurance, side bets, ranking, or item rewards.
- Image renderer is minimal (not polished production card art); standard text responses work without media support.
- No automatic DM initiation guarantees: the user may need to message the bot first.
- Compatibility of group messages, LID identity, buttons, and PNG must be tested on actual WhatsApp accounts.
