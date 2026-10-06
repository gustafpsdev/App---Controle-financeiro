-- TravelCash • Esquema relacional (SQLite) — CP2
-- Decisões de modelagem documentadas em docs/MODELAGEM.md

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  avatar      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS trips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  destination TEXT,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  travelers   INTEGER NOT NULL DEFAULT 1 CHECK (travelers >= 1),
  status      TEXT    NOT NULL DEFAULT 'Planejamento'
              CHECK (status IN ('Planejamento','Em andamento','Concluída')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (end_date >= start_date)
);

-- 1 orçamento por viagem (UNIQUE em trip_id)
CREATE TABLE IF NOT EXISTS budgets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       INTEGER NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
  total_budget  REAL    NOT NULL CHECK (total_budget >= 0),
  daily_budget  REAL    CHECK (daily_budget IS NULL OR daily_budget >= 0),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Categorias normalizadas (antes eram texto livre repetido em cada despesa)
CREATE TABLE IF NOT EXISTS categories (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  color  TEXT NOT NULL DEFAULT '#8c9aa0'
);

CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description  TEXT    NOT NULL,
  amount       REAL    NOT NULL CHECK (amount > 0),
  date         TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS itinerary (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date            TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  location        TEXT,
  estimated_cost  REAL    NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS transports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type         TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  amount       REAL    NOT NULL CHECK (amount >= 0),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS insurances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL,
  coverage    TEXT    NOT NULL,
  amount      REAL    NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- "progress" removido: é derivado de current_amount / target_amount (calculado na API)
CREATE TABLE IF NOT EXISTS goals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  target_amount   REAL    NOT NULL CHECK (target_amount > 0),
  current_amount  REAL    NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL CHECK (type IN ('info','warning','danger')),
  title       TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Índices nas colunas usadas em filtros, JOINs e ordenações
CREATE INDEX IF NOT EXISTS idx_trips_user          ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_date  ON expenses(trip_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_trip_date ON itinerary(trip_id, date);
CREATE INDEX IF NOT EXISTS idx_transports_trip     ON transports(trip_id);
CREATE INDEX IF NOT EXISTS idx_insurances_trip     ON insurances(trip_id);
CREATE INDEX IF NOT EXISTS idx_alerts_trip         ON alerts(trip_id);
CREATE INDEX IF NOT EXISTS idx_goals_user          ON goals(user_id);
