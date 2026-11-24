PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  coins REAL NOT NULL DEFAULT 10000,
  wallet_address TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commodities (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  prev_price REAL NOT NULL,
  npc_stock INTEGER NOT NULL DEFAULT 1000,
  spread_pct REAL NOT NULL DEFAULT 0.03,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  commodity_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_basis REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(player_id, commodity_id),
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(commodity_id) REFERENCES commodities(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  commodity_id TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  fee REAL NOT NULL,
  total_coins REAL NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(commodity_id) REFERENCES commodities(id)
);

CREATE TABLE IF NOT EXISTS ton_txs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT UNIQUE,
  amount_nano TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id)
);

INSERT OR IGNORE INTO commodities (id, symbol, name, price, prev_price, npc_stock, spread_pct, updated_at) VALUES
('cmd_energy',  'ENERGY',  'Energy Core',   120.0, 120.0, 1000, 0.03, strftime('%s','now')*1000),
('cmd_alloy',   'ALLOY',   'Rare Alloy',    240.0, 240.0, 800,  0.03, strftime('%s','now')*1000),
('cmd_chip',    'CHIP',    'Quantum Chip',  580.0, 580.0, 500,  0.04, strftime('%s','now')*1000),
('cmd_data',    'DATA',    'Data Ore',       75.0,  75.0, 1500, 0.02, strftime('%s','now')*1000),
('cmd_fuel',    'FUEL',    'Fusion Fuel',   160.0, 160.0, 1200, 0.03, strftime('%s','now')*1000),
('cmd_crystal', 'CRYSTAL', 'Void Crystal',  950.0, 950.0, 300,  0.04, strftime('%s','now')*1000);
