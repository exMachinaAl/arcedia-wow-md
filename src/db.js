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
    CREATE TABLE IF NOT EXISTS processed_messages (
      event_key TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function inTransaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
