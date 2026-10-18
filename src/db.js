import {initChatIdentity} from './wa/chat-identity.js';
import {initAdminSettings} from './admin-settings.js';
import {initWorldSocial} from './world-social.js';
import {initWorldMarket} from './world-market.js';
import {initWorldAdaptive} from './world-adaptive.js';
import {initInventory} from './inventory.js';
import {initWorldIntelligence} from './world-intelligence.js';
import {initWorldCommunity} from './world-community.js';
import {initArcade} from './arcade.js';
import {initWorldEconomy} from './world-economy.js';
import {initWorldLifecycle} from './world-lifecycle.js';
import {initPvpEconomy} from './pvp-economy.js';
import {initChess} from './chess.js';
import {initBlackjack} from './blackjack.js';
import {initIntelligence} from './intelligence.js';
import {initMultiplayer} from './multiplayer.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(file = process.env.WA_DB_PATH ?? './data/world.sqlite') {
  if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE','PRIORITY')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0)
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      delta INTEGER NOT NULL CHECK(delta > 0),
      reason TEXT NOT NULL,
      event_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS game_sessions (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      name TEXT NOT NULL,
      secret INTEGER NOT NULL,
      attempts_left INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      xp INTEGER NOT NULL DEFAULT 0 CHECK(xp >= 0),
      plays INTEGER NOT NULL DEFAULT 0 CHECK(plays >= 0),
      wins INTEGER NOT NULL DEFAULT 0 CHECK(wins >= 0),
      nickname TEXT,
      ranked INTEGER NOT NULL DEFAULT 0 CHECK(ranked IN (0,1))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_player_nickname_ci ON player_stats(nickname COLLATE NOCASE) WHERE nickname IS NOT NULL;
    CREATE TABLE IF NOT EXISTS daily_claims (
      user_id TEXT NOT NULL REFERENCES users(id),
      claim_day TEXT NOT NULL,
      streak INTEGER NOT NULL CHECK(streak > 0),
      PRIMARY KEY(user_id, claim_day)
    );
    CREATE TABLE IF NOT EXISTS daily_game_earnings (
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      earned INTEGER NOT NULL CHECK(earned BETWEEN 0 AND 100),
      PRIMARY KEY(user_id,day)
    );
    CREATE TABLE IF NOT EXISTS challenge_sessions (
      user_id TEXT NOT NULL REFERENCES users(id),
      game TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id,game)
    );
    CREATE TABLE IF NOT EXISTS daily_mission_progress (
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      plays INTEGER NOT NULL DEFAULT 0 CHECK(plays>=0),
      wins INTEGER NOT NULL DEFAULT 0 CHECK(wins>=0),
      PRIMARY KEY(user_id,day)
    );
    CREATE TABLE IF NOT EXISTS daily_mission_claims (
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      mission TEXT NOT NULL,
      PRIMARY KEY(user_id,day,mission)
    );
    CREATE TABLE IF NOT EXISTS ai_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS ai_calls (
      event_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      created_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_calls_user_day ON ai_calls(user_id,day);
    CREATE INDEX IF NOT EXISTS idx_ai_calls_user_time ON ai_calls(user_id,created_ms);
    CREATE TABLE IF NOT EXISTS ai_replies (
      event_key TEXT PRIMARY KEY REFERENCES ai_calls(event_key),
      user_id TEXT NOT NULL REFERENCES users(id),
      response TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS friend_requests (
      sender_id TEXT NOT NULL REFERENCES users(id),
      target_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('PENDING','ACCEPTED','DECLINED')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY(sender_id,target_id),
      CHECK(sender_id<>target_id)
    );
    CREATE TABLE IF NOT EXISTS friendships (
      user_a TEXT NOT NULL REFERENCES users(id),user_b TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY(user_a,user_b), CHECK(user_a<user_b)
    );
    CREATE TABLE IF NOT EXISTS social_blocks (
      blocker TEXT NOT NULL REFERENCES users(id),blocked TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY(blocker,blocked),CHECK(blocker<>blocked)
    );
    CREATE TABLE IF NOT EXISTS social_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      transfer_enabled INTEGER NOT NULL DEFAULT 0 CHECK(transfer_enabled IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 50),
      day TEXT NOT NULL,created_at INTEGER NOT NULL,CHECK(sender_id<>receiver_id)
    );
    CREATE INDEX IF NOT EXISTS idx_transfers_sender_day ON transfers(sender_id,day);
    CREATE TABLE IF NOT EXISTS transfer_entries (
      transfer_id TEXT NOT NULL REFERENCES transfers(id),user_id TEXT NOT NULL REFERENCES users(id),
      delta INTEGER NOT NULL CHECK(delta<>0),PRIMARY KEY(transfer_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS duels (
      id TEXT PRIMARY KEY,player_a TEXT NOT NULL REFERENCES users(id),player_b TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('INVITED','ACTIVE','DONE','DECLINED','CANCELLED','EXPIRED')),
      created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,winner_id TEXT REFERENCES users(id),completed_at INTEGER,
      CHECK(player_a<>player_b)
    );
    CREATE INDEX IF NOT EXISTS idx_duels_invites ON duels(player_b,status,expires_at);
    CREATE TABLE IF NOT EXISTS duel_moves (
      duel_id TEXT NOT NULL REFERENCES duels(id),user_id TEXT NOT NULL REFERENCES users(id),
      move TEXT NOT NULL CHECK(move IN ('batu','gunting','kertas')),
      PRIMARY KEY(duel_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS processed_messages (
      event_key TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  initAdminSettings(db);
  initChatIdentity(db);
  initInventory(db);
  initWorldIntelligence(db);
  initWorldCommunity(db);
  initWorldMarket(db);
  initWorldAdaptive(db);
  initWorldSocial(db);
  initArcade(db);
  initWorldEconomy(db);
  initWorldLifecycle(db);
  initMultiplayer(db);
  initChess(db);
  initBlackjack(db);
  initIntelligence(db);
  initPvpEconomy(db);
  db.exec(`CREATE TRIGGER IF NOT EXISTS wow_no_transfers_insert BEFORE INSERT ON transfers BEGIN SELECT RAISE(ABORT, 'V transfers permanently disabled by WOW policy'); END; CREATE TRIGGER IF NOT EXISTS wow_no_transfers_setting_insert BEFORE INSERT ON social_settings WHEN NEW.transfer_enabled=1 BEGIN SELECT RAISE(ABORT, 'V transfers permanently disabled'); END; CREATE TRIGGER IF NOT EXISTS wow_no_transfers_enable BEFORE UPDATE OF transfer_enabled ON social_settings WHEN NEW.transfer_enabled=1 BEGIN SELECT RAISE(ABORT, 'V transfers permanently disabled'); END; UPDATE social_settings SET transfer_enabled=0 WHERE transfer_enabled=1;`);
  return db;
}

export function inTransaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
