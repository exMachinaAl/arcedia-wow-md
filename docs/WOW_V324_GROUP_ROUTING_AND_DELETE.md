# WOW v3.2.4 — Group Selector & Delete Diagnostics

## Verified live results before this patch
- User verified mixed buttons are visible in groups.
- User verified WOW Chat mirrors/decoration from **common players**.
- Actual deletion failed for admin and common players (OPEN, not claimed fixed).
- Selecting menu choices looped back to the root menu (this patch fixes dispatch).

## Group navigation
Type `.menu`, `.games`, `.wowmenu`, `.help`, or choose a row/button.
- Menu -> existing `.menu` core response and original 12-option main selector.
- Games -> actual `.games` response + group-specific game selector.
- Menu Lainnya -> different World/Pulse/Guild selector.
- Arena -> PvP guidance and different arena selector.
- Jelajah -> world navigation selector.
- World Pulse / Reputasi / Musim / Guild -> actual allowed public action (not root menu).
- Private Daily Shop / Inventory / Arcade -> clear DM guidance; no loop.

The client displays 3 quick-replies plus an expandable selector, not 12 simultaneous native buttons.
No group selection gives access to admin, currency grants, or private player transactions.

## Delete reliability
- `messages.update` **and** `message-receipt.update` are monitored.
- A real group recipient receipt for the exact outgoing bot message may advance WAIT_ACK -> READY.
- `sock.sendMessage` return or `status=2` alone NEVER authorizes deleting a member's original.
- Bot group admin is verified against real WhatsApp group metadata, including LID and phone JIDs when provided.
- `.wowchat diagnose` now includes bot admin YES/NO and concrete delete skip/fail causes.
- After shutdown, ambiguous deletes are NOT replayed.
- If no receipt is received, the original remains untouched. A missing receipt is not silently replaced with an unsafe timer.

## Minimal live tests
1. Common player opens `.menu`, selects `Permainan`, verifies list and a DIFFERENT selector; selects `Menu Lainnya` then `World Pulse` and gets real output.
2. Admin runs `.wowchat diagnose` in group; check `Bot admin grup: YA`, `WAIT_ACK`, and `Alasan Delete` after test.
3. Use Mirror before trying Replace. If Replace fails, provide diagnostics, not private message contents.

**No top-up, no real currency, no transfer or auction policy changes.**
