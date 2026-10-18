# v1.3 Player Intelligence (BETA)

## Objectives
- Chess and snakes private statistics from persisted match results, aggregate stats for admins without player IDs.
- Collect *only after v1.3* pre-match chess ratings. Old results cannot reconstruct ratings retrospectively.
- Train local logistic regression from rated finished matches with 30 eligible games, 8 unique players, at most 3 per player pair, 8 wins for each color, chronological 80/20 holdout.
- Activate model **only** if its holdout Brier score beats the Elo baseline by >0.005, otherwise Elo matchmaking remains.
- ML never manipulates dice, random draws, item drops, game results, or bets. ML does not send any information externally.
- No model data is available on public APIs, only aggregate metrics.
- If trainer fails, Elo remains available. Model loading requires a valid approval file and recent training.

## Commands
`.insights` private PvP record; `.insights world` aggregated arena; `.model status` active/fallback status. `ML-TRAIN.bat` on server trains once; restart bot to use approved model.

## Testing
Mandatory offline test suite; live: pairing, `.menu`, `.insights`, and PvP match completion on two accounts. ML training optional until dataset minimum.

## Operational cautions
- SQLite dataset and training metadata contain user identifiers; keep `data/` private.
- Existing old matches are visible in match stats, but never backfilled into ML samples.
- Trainer does not retrain automatically; run intentionally when enough real sample data is available.
- Matchmaking uses opt-in, never unsolicited WhatsApp outreach.
