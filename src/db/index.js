const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("../config");

const SCHEMA = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const SEED_FILE = path.join(__dirname, "..", "..", "data", "seed.json");

const DEFAULT_CATEGORIES = [
  ["Hospedagem", "#3f91d6"],
  ["Alimentação", "#57b26f"],
  ["Transporte", "#f4a32b"],
  ["Passeios", "#9271bf"],
  ["Compras", "#e57b9c"],
  ["Outros", "#e3bd35"]
];

let db;

function seed(conn) {
  const insertCategory = conn.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)");
  for (const [name, color] of DEFAULT_CATEGORIES) insertCategory.run(name, color);

  const hasData = conn.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0;
  if (hasData || !config.seed || !fs.existsSync(SEED_FILE)) return;

  const data = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const categoryId = (name) =>
    conn.prepare("SELECT id FROM categories WHERE name = ?").get(name)?.id ??
    conn.prepare("SELECT id FROM categories WHERE name = 'Outros'").get().id;

  const tx = conn.transaction(() => {
    for (const u of data.users || []) {
      conn.prepare("INSERT INTO users (id, name, email, avatar) VALUES (?, ?, ?, ?)")
        .run(u.id, u.name, u.email, u.avatar ?? null);
    }
    for (const t of data.trips || []) {
      conn.prepare(`INSERT INTO trips (id, user_id, name, destination, start_date, end_date, travelers, status)
                    VALUES (?, 1, ?, ?, ?, ?, ?, ?)`)
        .run(t.id, t.name, t.destination ?? null, t.startDate, t.endDate, t.travelers ?? 1, t.status ?? "Planejamento");
    }
    for (const b of data.budgets || []) {
      conn.prepare("INSERT INTO budgets (id, trip_id, total_budget, daily_budget) VALUES (?, ?, ?, ?)")
        .run(b.id, b.tripId, b.totalBudget, b.dailyBudget ?? null);
    }
    for (const e of data.expenses || []) {
      conn.prepare("INSERT INTO expenses (id, trip_id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?, ?)")
        .run(e.id, e.tripId, categoryId(e.category), e.description, e.amount, e.date);
    }
    for (const i of data.itinerary || []) {
      conn.prepare("INSERT INTO itinerary (id, trip_id, date, title, location, estimated_cost) VALUES (?, ?, ?, ?, ?, ?)")
        .run(i.id, i.tripId, i.date, i.title, i.location ?? null, i.estimatedCost ?? 0);
    }
    for (const t of data.transports || []) {
      conn.prepare("INSERT INTO transports (id, trip_id, type, description, amount) VALUES (?, ?, ?, ?, ?)")
        .run(t.id, t.tripId, t.type, t.description, t.amount ?? 0);
    }
    for (const i of data.insurances || []) {
      conn.prepare("INSERT INTO insurances (id, trip_id, provider, coverage, amount) VALUES (?, ?, ?, ?, ?)")
        .run(i.id, i.tripId, i.provider, i.coverage, i.amount ?? 0);
    }
    for (const g of data.goals || []) {
      conn.prepare("INSERT INTO goals (id, user_id, name, target_amount, current_amount) VALUES (?, 1, ?, ?, ?)")
        .run(g.id, g.name, g.targetAmount, g.currentAmount ?? 0);
    }
    for (const a of data.alerts || []) {
      conn.prepare("INSERT INTO alerts (id, trip_id, type, title, message) VALUES (?, ?, ?, ?, ?)")
        .run(a.id, a.tripId, a.type, a.title, a.message);
    }
  });
  tx();
}

function getDb() {
  if (db) return db;
  if (config.dbFile !== ":memory:") fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  db = new Database(config.dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seed(db);
  return db;
}

/** Usado pelos testes para começar com um banco limpo. */
function resetDb() {
  if (db) db.close();
  db = undefined;
  return getDb();
}

module.exports = { getDb, resetDb };
