# WOW v3.2.3 — Group UX and Chat Reliability

- `.wowmenu`, `.menu`, `.games`, `.help` in groups use XLICON-style mixed native flow: three quick-replies plus a 12-choice selector.
- Player-only economy actions remain restricted to DM even if presented as navigation.
- Mode Replace with missing deletion consent now mirrors the decorated text without attempting a revoke. This avoids silencing common players.
- `.wowchat diagnose` reports queue *status breakdown* and deletion state, instead of presenting all historical jobs as pending.
- **Delete is not certified**: WhatsApp delivery receipts may not be emitted in every Baileys/client combination. Until verified on real devices, keep Replace/Delete OFF and use Mirror.
- Never auto-delete without successful relay and eligible delivery receipt. All permissions remain opt-in.
- Group menu is interactive when the confirmed mixed relay is supported; selector rows beyond three are NOT eight simultaneous quick-replies.
