const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "db.json");

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function list(collection, filters = {}) {
  const db = readDb();
  let rows = Array.isArray(db[collection]) ? db[collection] : [];
  for (const [key, value] of Object.entries(filters)) {
    rows = rows.filter((row) => Number(row[key]) === Number(value));
  }
  return rows;
}

function get(collection, id) {
  return list(collection).find((row) => Number(row.id) === Number(id)) || null;
}

function create(collection, payload) {
  const db = readDb();
  if (!Array.isArray(db[collection])) db[collection] = [];
  const row = { ...payload, id: nextId(db[collection]) };
  delete row.undefined;
  db[collection].push(row);
  writeDb(db);
  return row;
}

function update(collection, id, payload) {
  const db = readDb();
  const index = db[collection].findIndex((row) => Number(row.id) === Number(id));
  if (index < 0) return null;
  db[collection][index] = { ...db[collection][index], ...payload, id: Number(id) };
  writeDb(db);
  return db[collection][index];
}

function remove(collection, id) {
  const db = readDb();
  const index = db[collection].findIndex((row) => Number(row.id) === Number(id));
  if (index < 0) return false;
  db[collection].splice(index, 1);
  writeDb(db);
  return true;
}

module.exports = { list, get, create, update, remove };
