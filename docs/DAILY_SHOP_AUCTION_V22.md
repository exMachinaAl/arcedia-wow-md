# WOW v2.2 — Daily Shop & Auction Foundation

## Production state

Daily Shop is enabled for self-hosted private-chat testing. Auction is deliberately **OFF by default**. The full auction mechanism can be tested in an isolated staging environment using an explicit `WOW_AUCTION_ENABLED=1` setting; do not enable it on a public WhatsApp bot before policy and abuse review.

## Daily Shop

- `.dailyshop`: 3 of 5 offers selected deterministically each WIB day (fixed SHA-256 selection, public and stable for the day); prices vary within ±2 V, no ML-controlled purchasing odds.
- `.dailyshop buy focus-token 1`, `.dailyshop buy copper 1`: cost taken from main V wallet, item/material granted atomically.
- Maximum 3 units purchased daily per user, 120 units per offer per day across server, item/material caps respected.
- `.dailyshop history`: latest purchases. Inventory items share existing item registry and consumable rules; goods bought do not become tradable automatically.
- `GET /api/v1/dailyshop`: aggregate offer/market stats from local dashboard.

## Auction staging (disabled by default)

- Only earned Copper, Iron and Crystal *materials* can be listed; no gacha items, exclusive cosmetic items, cash or real property.
- `.auction sell copper 2 30`, `.auction bid 1 35`, `.auction settle 1`, `.auction cancel 1`.
- Bidder's V is removed and held by server escrow; old bidder refunded atomically on outbid. No direct V transfer command.
- At expiry (60 minutes) seller or winner calls `.auction settle ID` to settle; 5% fee is removed, net V to seller, material to winner. No-bid listings return material. **Expiry processing is not yet an automated background job.**
- Eligibility: >=10 game plays, account >=72 hours old, no own bids or same-guild bids, max 2 open/3 listings per 24h, bids 10–500 V. An account may still collude outside the system; these are starter controls only.
- Transactions run inside `BEGIN IMMEDIATE`; wallet changes use conditional debits, unique replay keys, ledger audit, persisted listing state.

## Unchanged project rules

- Top-up, cash-out and external money conversion forbidden. `.pay`/direct user-to-user transfers remain disabled.
- Auction is an internal controlled material exchange, not free V transfer. All game of chance outcomes remain separate from tradeable material catalog.
- Public release requires review of Indonesian gaming laws and the messaging platform's rules (especially virtual currency and gambling restrictions).
- SQLite persists during gateway shutdown. Stop bot/dashboard before ZIP install, backup complete `data/` directory, restart after patch. Source rollback does not revert database activity.

## QA

- Offline 287 tests expected, including 13 new market tests.
- Live required after upgrade: `.dailyshop`, buy one offered SKU, check wallet and inventory/material.
- Auction live is optional AND gated; do not claim publicly supported.
