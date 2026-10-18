# WA-WORLD 1.6: Free Arcade product and safety rules

**Design boundary:** arcade points and cosmetic capsules have zero monetary redemption and no trading, transfers, sales or buy-ins. Spins are free and daily limited. Never add wager staking, rewards exchanged to V-Currency, purchased randomized prizes, cash-out, or forced urgency. Confirm legality and WhatsApp platform policy before public rollout.

## Features
- `.arcade`: entry/status and daily free play availability.
- `.gacha claim`: one free capsule per WIB day, odds: COMMON 70%, UNCOMMON 24%, RARE 5%, LEGENDARY 1%. Public odds via `.gacha odds`. Uniquely collected by account; duplicates do not generate value or an additional draw.
- `.slot spin`: 10 positions, each independent and uniform across 3 symbols, longest consecutive equal-symbol run pays **only Arcade Score**, which is a nonredeemable activity statistic. 3 free spins/day; `.slot odds` publishes mechanism. Longest run >=3 yields `5 × 2^(run-3)` scores; maximum 10 run yields 640 points. No prizes, no purchasable rerolls, no debt.
- `.risk create`, `.risk join CODE`, `.risk choose CODE safe|balanced|legend`, `.risk status CODE`, `.risk resolve CODE`: cooperative room with 2–8 consenting players and one shared RNG roll. `safe` 70%→10 points, `balanced` 35%→25 points, `legend` 10%→80 points, and failure→0, not a loss. Creator resolves after all choose; rooms expire after 30 min. No wager or pooled balances. Identity is pseudonymous in shared room status. DM-only; user exchanges code voluntarily.
- Built as separate modules and DB tables; logs and results survive restart, no modification to old wallets or items.

## No fake ML
ML can suggest challenges from opt-in, aggregated history and may predict which mode player enjoys. The probability table and crypto-random results must be fixed and **independent** of user history, level, paid status, and ML output.

## Future/backlog
PNG reel pointer animation; server message notifications when room ready; crafting and seasonal cosmetics; explicit privacy consent for ML. Those are **not** implemented in v1.6.

## QA
Offline `npm test` / `QA-ONE-CLICK.bat`. Live required `.arcade` native panel → Slot → Spin, optional gacha and room. Do not mark production ready from unit test alone.

## v1.7 change
Gacha, Symbol Match and Risk Room successes additionally reward bound Arcade V (up to 40 V/day). This currency is nontransferable and used only for fixed-price cosmetic items; main V wallet remains unaffected.
