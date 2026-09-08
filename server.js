const express = require("express");
const cors = require("cors");
const path = require("path");
const { randomUUID } = require("crypto");
const store = require("./src/store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

const resources = {
  users: "users",
  trips: "trips",
  budgets: "budgets",
  expenses: "expenses",
  itinerary: "itinerary",
  transports: "transports",
  insurances: "insurances",
  goals: "goals",
  alerts: "alerts"
};

function ok(res, data, status = 200, meta = undefined) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function fail(res, status, code, message, details = undefined) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) }
  });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateBody(body, required = []) {
  const missing = required.filter((key) =>
    body[key] === undefined || body[key] === null || body[key] === ""
  );
  return missing;
}

function registerCrud(resource, required = []) {
  const collection = resources[resource];

  app.get(`/api/${resource}`, (req, res) => {
    const tripId = req.query.tripId ? parseId(req.query.tripId) : null;
    if (req.query.tripId && !tripId) {
      return fail(res, 400, "INVALID_TRIP_ID", "tripId deve ser um número inteiro positivo.");
    }
    const rows = store.list(collection, tripId ? { tripId } : undefined);
    return ok(res, rows);
  });

  app.get(`/api/${resource}/:id`, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "INVALID_ID", "ID inválido.");
    const row = store.get(collection, id);
    if (!row) return fail(res, 404, "NOT_FOUND", `${resource} não encontrado.`);
    return ok(res, row);
  });

  app.post(`/api/${resource}`, (req, res) => {
    const missing = validateBody(req.body, required);
    if (missing.length) {
      return fail(res, 400, "VALIDATION_ERROR", "Campos obrigatórios ausentes.", missing);
    }
    const created = store.create(collection, {
      ...req.body,
      id: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return ok(res, created, 201);
  });

  app.put(`/api/${resource}/:id`, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "INVALID_ID", "ID inválido.");
    const existing = store.get(collection, id);
    if (!existing) return fail(res, 404, "NOT_FOUND", `${resource} não encontrado.`);

    const missing = validateBody({ ...existing, ...req.body }, required);
    if (missing.length) {
      return fail(res, 400, "VALIDATION_ERROR", "Campos obrigatórios ausentes.", missing);
    }

    const updated = store.update(collection, id, {
      ...req.body,
      id,
      updatedAt: new Date().toISOString()
    });
    return ok(res, updated);
  });

  app.delete(`/api/${resource}/:id`, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "INVALID_ID", "ID inválido.");
    const deleted = store.remove(collection, id);
    if (!deleted) return fail(res, 404, "NOT_FOUND", `${resource} não encontrado.`);
    return ok(res, { id, deleted: true });
  });
}

registerCrud("users", ["name", "email"]);
registerCrud("trips", ["name", "startDate", "endDate"]);
registerCrud("budgets", ["tripId", "totalBudget"]);
registerCrud("expenses", ["tripId", "category", "description", "amount", "date"]);
registerCrud("itinerary", ["tripId", "date", "title"]);
registerCrud("transports", ["tripId", "type", "description", "amount"]);
registerCrud("insurances", ["tripId", "provider", "coverage"]);
registerCrud("goals", ["name", "targetAmount", "currentAmount"]);
registerCrud("alerts", ["tripId", "type", "title", "message"]);

app.get("/api/health", (_req, res) => {
  return ok(res, { status: "online", timestamp: new Date().toISOString() });
});

app.get("/api/dashboard", (req, res) => {
  const tripId = req.query.tripId ? parseId(req.query.tripId) : 1;
  if (!tripId) return fail(res, 400, "INVALID_TRIP_ID", "tripId inválido.");

  const trip = store.get("trips", tripId);
  if (!trip) return fail(res, 404, "TRIP_NOT_FOUND", "Viagem não encontrada.");

  const budget = store.list("budgets", { tripId })[0] || { totalBudget: 0 };
  const expenses = store.list("expenses", { tripId });
  const itinerary = store.list("itinerary", { tripId });
  const transports = store.list("transports", { tripId });
  const insurances = store.list("insurances", { tripId });
  const alerts = store.list("alerts", { tripId });

  const totalSpent = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const categoryTotals = {};
  for (const item of expenses) {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + Number(item.amount || 0);
  }

  const totalBudget = Number(budget.totalBudget || 0);
  const remaining = totalBudget - totalSpent;
  const days = Math.max(
    1,
    Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1
  );

  const dailyAverage = totalSpent / days;
  const utilization = totalBudget ? (totalSpent / totalBudget) * 100 : 0;

  return ok(res, {
    trip,
    budget,
    summary: {
      totalBudget,
      totalSpent,
      remaining,
      utilization,
      dailyAverage,
      days
    },
    categoryTotals,
    itinerary: itinerary.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    transports,
    insurances,
    alerts: alerts.slice(0, 5),
    expenses: expenses.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    goals: store.list("goals")
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return fail(res, 404, "ROUTE_NOT_FOUND", "Endpoint não encontrado.");
  }
  return res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof SyntaxError && "body" in err) {
    return fail(res, 400, "INVALID_JSON", "JSON inválido na requisição.");
  }
  return fail(res, 500, "INTERNAL_ERROR", "Erro interno do servidor.");
});

app.listen(PORT, () => {
  console.log(`TravelCash rodando em http://localhost:${PORT}`);
});
