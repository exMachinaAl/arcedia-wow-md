# WOW v3.3.0 — Interactive DM, Blackjack Cards & Group Revoke Audit

## Live results already reported

- Group mixed buttons/selector: PASS.
- Common-player decoration: PASS.
- Deleting admin message: PASS; deleting common-player message: FAIL.
- DM selector and Blackjack card-action UX: PENDING_LIVE.

## New user journey

1. DM `.menu` displays three quick replies plus a selector of 12 actions. This is a real native-flow payload; it does not rely on text-only menu simulation.
2. DM `.games` opens a selector with game choices; `.bj status` opens Blackjack controls.
3. `.bj create` > tap Start > receive private PNG hand > tap Hit/Stand; each action uses the existing SQLite game engine, with idempotent event keys.
4. Private Blackjack start notifications also send best-effort card images and action controls. Image/control failures do not replay financial/game mutations.
5. `.buttons mixed` and `.buttons selector` in DM provide additional controlled diagnostics.

## Delete limitation

The original Baileys group message key is now persisted verbatim in a restricted schema (group JID, message ID, actual participant and fromMe=false). No sender identity is fabricated or guessed. Revoke remains guarded by server/group/user consent, verified bot-admin status, expiry and receipt ACK. `DELETE_REQUESTED` means a revoke was submitted, not that every client's UI removed the message. WhatsApp live test for common-player delete remains FAIL until verified; do not enable mass Replace until resolved.

## Safety & performance

- No cash-out or real-money functionality.
- Private Blackjack hands are never sent to a group.
- Group bot messages are never reprocessed as incoming player messages.
- No forced resend after ambiguous restart; SQLite source state persists.
- Mixed interactive rendering must be verified live on the user's WhatsApp client.
- Old text commands continue to work as fallback.
