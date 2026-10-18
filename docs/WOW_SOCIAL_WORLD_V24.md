# WOW v2.4 — Group Guild & World Intelligence

## Release scope

This is a meaningful social gameplay update built on v2.3; later improvements pause for user evaluation.

**DM:** `.guild create Aurora`, `.guild join Aurora`, `.reputation`, `.stats card`, `.worldpulse`. A player must join the guild in DM before guild group participation.

**Opt-in WhatsApp group:** Set `WA_ENABLE_GROUPS=true` inside your private `.env`; restart the gateway. This enables normal group command intake; a sender allowlist (WA_ALLOWED_JIDS) is strongly recommended for testing. The bot does NOT auto-join members to a guild by virtue of being in the WhatsApp group.

1. Guild Owner **who is also a real WhatsApp group admin** sends `.guildgroup link` in the group. This must be server-verified through Baileys `groupMetadata` and fails closed if metadata is missing or differs from sender ID.
2. Any linked guild member may `.guildgroup quest` once per day (existing guild quest rules).
3. Two distinct guild members completing their quest the same day unlock `.guildgroup rally`: +20 Guild XP once per guild/day, plus +0/5/10 World Pulse XP determined only by the previous completed WIB day.
4. `.guildgroup board` displays 7-day contribution. Nicknames are displayed only for profiles that explicitly opt-in to the leaderboard; others appear as anonymous row numbers.
5. `.guildgroup unlink` requires both Guild Owner and verified group admin; links and rallies retain audit records. One guild ↔ one chat, one chat ↔ one guild.

## Dynamic World Pulse

`.worldpulse` reads aggregate mining, guild quests, expeditions, and positive WOW V journal from the **previous completed WIB day**, then classifies as CALM, ACTIVE or BUSY with transparent thresholds. Only the **guild XP bonus** changes; this does not affect odds, V payout, ranked results, or account wealth. The rules are deterministic and stable across restart.

`.reputation` counts proven distinct mining days, completed expeditions, guild quests and seasons (bounded to prevent unconstrained accumulation). The PNG player card displays World Reputation; this number is **not** a guarantee of trustworthiness or an anti-cheat verdict.

## Security and known limits

- `WA_ENABLE_GROUPS` defaults to false. Test with a small dedicated WhatsApp group and a group/admin allowlist. Group JIDs are not exposed by the read-only `/api/v1/world-social` endpoint.
- Admin verification is performed at execution time. On versions of Baileys where LID/Pn identifiers do not match `groupMetadata` participant IDs, linking will be denied rather than incorrectly permitted. **Verify this live** before public release.
- The project uses an unofficial WhatsApp Web adapter. Official WhatsApp policy and safety assessment remain necessary.
- Player action dedupe is keyed to the actual WhatsApp message ID; existing SQLite transactions keep rally rewards exactly once. Group link/rally records persist across graceful restart or crash recovery.
- Auction remains OFF. Direct V transfers, top-up, real cash-out, transferable RNG winnings, or unrestricted user-to-user spending are not introduced.
- Smart recommendations from v2.0 remain opt-in. No new trained ML model is claimed in v2.4; Guild Pulse is statistics/transparent rules, not trained AI. The random game outcomes stay independent.
- Offline tests cannot verify on-device WhatsApp messages, actual group admin resolution, button rendering, or production network conditions.
