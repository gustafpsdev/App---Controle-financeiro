const { getDb } = require("./db");
const { resources } = require("./resources");
const { errors } = require("./errors");
const { applyRules } = require("./validation");

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function cfgOf(name) {
  const cfg = resources[name];
  if (!cfg) throw new Error(`Recurso desconhecido: ${name}`);
  return cfg;
}

/** Monta o SELECT que converte snake_case do banco para camelCase da API. */
function baseSelect(cfg) {
  const cols = ["t.id AS id"];
  for (const [field, spec] of Object.entries(cfg.fields)) {
    if (spec.type === "category") continue; // vem do JOIN
    cols.push(`t.${spec.col} AS "${field}"`);
  }
  if (cfg.timestamps !== false) cols.push('t.created_at AS "createdAt"', 't.updated_at AS "updatedAt"');
  if (cfg.extraSelect) cols.push(cfg.extraSelect);
  return `SELECT ${cols.join(", ")} FROM ${cfg.table} t ${cfg.join || ""}`;
}

function sortClause(cfg, sortParam) {
  const raw = String(sortParam || cfg.defaultSort || "id");
  const desc = raw.startsWith("-");
  const key = desc ? raw.slice(1) : raw;
  const allowed = [...(cfg.sortable || []), ...Object.keys(cfg.sortExtra || {}), "id"];
  if (!allowed.includes(key)) {
    throw errors.badRequest("INVALID_SORT", `Ordenação inválida. Use um destes campos: ${allowed.join(", ")} (prefixo "-" para decrescente).`);
  }
  const expr = cfg.sortExtra?.[key] || `"${key}"`;
  return { sql: `ORDER BY ${expr} ${desc ? "DESC" : "ASC"}, t.id ${desc ? "DESC" : "ASC"}`, applied: raw };
}

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw errors.badRequest("INVALID_QUERY", `${field} deve ser um número inteiro positivo.`);
  return n;
}

/**
 * Lista com filtros, busca, ordenação e paginação — tudo resolvido no SQL.
 */
function list(name, query = {}) {
  const cfg = cfgOf(name);
  const db = getDb();
  const where = [];
  const params = [];

  if (query.tripId !== undefined && cfg.fields.tripId) {
    where.push("t.trip_id = ?");
    params.push(positiveInt(query.tripId, "tripId"));
  }
  for (const [key, col] of Object.entries(cfg.filters || {})) {
    if (query[key] !== undefined && query[key] !== "") {
      where.push(`${col.includes(".") ? col : `t.${col}`} = ?`);
      params.push(query[key]);
    }
  }
  if (cfg.dateFilter) {
    for (const [key, op] of [["dateFrom", ">="], ["dateTo", "<="]]) {
      if (query[key]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query[key])) throw errors.badRequest("INVALID_QUERY", `${key} deve estar no formato AAAA-MM-DD.`);
        where.push(`${cfg.dateFilter} ${op} ?`);
        params.push(query[key]);
      }
    }
  }
  if (cfg.amountFilter) {
    for (const [key, op] of [["minAmount", ">="], ["maxAmount", "<="]]) {
      if (query[key] !== undefined && query[key] !== "") {
        const n = Number(query[key]);
        if (!Number.isFinite(n)) throw errors.badRequest("INVALID_QUERY", `${key} deve ser numérico.`);
        where.push(`${cfg.amountFilter} ${op} ?`);
        params.push(n);
      }
    }
  }
  if (query.search && cfg.search?.length) {
    const term = `%${String(query.search).slice(0, 100).replace(/[%_\\]/g, "\\$&")}%`;
    where.push(`(${cfg.search.map((f) => `t.${cfg.fields[f].col} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
    cfg.search.forEach(() => params.push(term));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = query.limit !== undefined ? Math.min(positiveInt(query.limit, "limit"), MAX_LIMIT) : DEFAULT_LIMIT;
  const page = query.page !== undefined ? positiveInt(query.page, "page") : 1;
  const sort = sortClause(cfg, query.sort);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM ${cfg.table} t ${cfg.join || ""} ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(`${baseSelect(cfg)} ${whereSql} ${sort.sql} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  return {
    rows,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), sort: sort.applied }
  };
}

function get(name, id) {
  const cfg = cfgOf(name);
  return getDb().prepare(`${baseSelect(cfg)} WHERE t.id = ?`).get(id) || null;
}

function getOrFail(name, id) {
  const row = get(name, id);
  if (!row) throw errors.notFound(`${cfgOf(name).label} com id ${id} não encontrado(a).`);
  return row;
}

/** Converte valores da API para colunas do banco, checando FKs e unicidade. */
function toColumns(cfg, values, currentId) {
  const db = getDb();
  const cols = {};
  const problems = [];

  for (const [field, value] of Object.entries(values)) {
    const spec = cfg.fields[field];
    if (!spec) continue;

    if (spec.type === "category") {
      const cat = db.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE").get(value);
      if (!cat) {
        const names = db.prepare("SELECT name FROM categories ORDER BY name").all().map((c) => c.name);
        problems.push({ field, message: `Categoria inexistente. Use: ${names.join(", ")}.` });
        continue;
      }
      cols[spec.col] = cat.id;
      continue;
    }

    if (spec.type === "ref" && value !== null) {
      const refCfg = cfgOf(spec.ref);
      if (!db.prepare(`SELECT 1 FROM ${refCfg.table} WHERE id = ?`).get(value)) {
        problems.push({ field, message: `${refCfg.label} com id ${value} não existe.` });
        continue;
      }
    }

    if (spec.unique && value !== null) {
      const dup = db
        .prepare(`SELECT id FROM ${cfg.table} WHERE ${spec.col} = ? ${spec.type === "email" ? "COLLATE NOCASE" : ""} AND id <> ?`)
        .get(value, currentId || 0);
      if (dup) throw errors.conflict(`Já existe ${cfg.label.toLowerCase()} com este valor de "${field}".`, [{ field, existingId: dup.id }]);
    }

    cols[spec.col] = value;
  }

  if (problems.length) throw errors.unprocessable("REFERENCE_ERROR", "Referência inválida.", problems);
  return cols;
}

function create(name, values) {
  const cfg = cfgOf(name);
  const ruleErrors = applyRules(cfg, values);
  if (ruleErrors.length) throw errors.unprocessable("BUSINESS_RULE", "Regra de negócio violada.", ruleErrors);

  const cols = toColumns(cfg, values);
  const keys = Object.keys(cols);
  const info = getDb()
    .prepare(`INSERT INTO ${cfg.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`)
    .run(...keys.map((k) => cols[k]));
  return get(name, Number(info.lastInsertRowid));
}

function update(name, id, values) {
  const cfg = cfgOf(name);
  const existing = getOrFail(name, id);
  const merged = { ...existing, ...values };
  const ruleErrors = applyRules(cfg, merged);
  if (ruleErrors.length) throw errors.unprocessable("BUSINESS_RULE", "Regra de negócio violada.", ruleErrors);

  const cols = toColumns(cfg, values, id);
  const keys = Object.keys(cols);
  if (!keys.length) return existing;
  if (cfg.timestamps !== false) {
    cols.updated_at = new Date().toISOString();
    keys.push("updated_at");
  }
  getDb()
    .prepare(`UPDATE ${cfg.table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .run(...keys.map((k) => cols[k]), id);
  return get(name, id);
}

function remove(name, id) {
  const cfg = cfgOf(name);
  getOrFail(name, id);
  getDb().prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).run(id);
  return true;
}

module.exports = { list, get, getOrFail, create, update, remove, MAX_LIMIT, DEFAULT_LIMIT };
