const { getDb } = require("../db");
const repo = require("../repository");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1;
}

/**
 * Regras de negócio que geram alertas automáticos a partir dos números da viagem.
 * Não são gravados no banco: são recalculados a cada consulta, então nunca ficam desatualizados.
 */
function buildAutoAlerts({ summary, categoryTotals, hasBudget, dailyBudget }) {
  const alerts = [];
  const push = (type, rule, title, message) => alerts.push({ id: null, auto: true, rule, type, title, message });

  if (!hasBudget) {
    push("warning", "NO_BUDGET", "Viagem sem orçamento definido", "Cadastre um orçamento para acompanhar o consumo.");
    return alerts;
  }
  if (summary.utilization >= 100) {
    push("danger", "BUDGET_EXCEEDED", "Orçamento estourado",
      `Os gastos ultrapassaram o orçamento em ${brl(summary.totalSpent - summary.totalBudget)}.`);
  } else if (summary.utilization >= 80) {
    push("warning", "BUDGET_80", `Você já utilizou ${summary.utilization.toFixed(1).replace(".", ",")}% do orçamento`,
      `Restam ${brl(summary.remaining)} para o restante da viagem.`);
  }
  if (dailyBudget && summary.dailyAverage > dailyBudget) {
    push("warning", "DAILY_OVER", "Média diária acima do limite",
      `Média de ${brl(summary.dailyAverage)}/dia contra limite de ${brl(dailyBudget)}/dia.`);
  }
  if (summary.projectedTotal > summary.totalBudget && summary.utilization < 100) {
    push("warning", "PROJECTION_OVER", "Projeção indica estouro do orçamento",
      `No ritmo atual, a viagem deve custar ${brl(summary.projectedTotal)}.`);
  }
  for (const c of categoryTotals) {
    if (summary.totalSpent > 0 && c.share >= 40) {
      push("info", "CATEGORY_CONCENTRATION", `${c.category} concentra ${c.share.toFixed(0)}% dos gastos`,
        "Verifique se essa concentração estava prevista no planejamento.");
    }
  }
  return alerts;
}

/**
 * Dashboard consolidado de uma viagem.
 * Otimização: todas as agregações são feitas no SQL (SUM/GROUP BY) em uma única conexão,
 * em vez de carregar todas as despesas e somar no JavaScript.
 */
function getTripDashboard(tripId, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const db = getDb();
  const trip = repo.getOrFail("trips", tripId);
  const budget = db.prepare(
    'SELECT id, trip_id AS "tripId", total_budget AS "totalBudget", daily_budget AS "dailyBudget" FROM budgets WHERE trip_id = ?'
  ).get(tripId);

  const totals = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count, COALESCE(MAX(amount),0) AS largest FROM expenses WHERE trip_id = ?"
  ).get(tripId);

  const byCategory = db.prepare(`
    SELECT c.name AS category, c.color AS color, SUM(e.amount) AS total, COUNT(*) AS count
    FROM expenses e JOIN categories c ON c.id = e.category_id
    WHERE e.trip_id = ? GROUP BY c.id ORDER BY total DESC`).all(tripId);

  const daily = db.prepare(
    "SELECT date, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE trip_id = ? GROUP BY date ORDER BY date"
  ).all(tripId);

  const planned = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM transports WHERE trip_id = @id) AS transports,
      (SELECT COALESCE(SUM(amount),0) FROM insurances WHERE trip_id = @id) AS insurances,
      (SELECT COALESCE(SUM(estimated_cost),0) FROM itinerary WHERE trip_id = @id) AS itinerary`).get({ id: tripId });

  const totalBudget = round2(budget?.totalBudget);
  const totalSpent = round2(totals.total);
  const days = Math.max(1, daysBetween(trip.startDate, trip.endDate));
  const elapsed = Math.min(days, Math.max(1, daysBetween(trip.startDate, today)));
  const inProgress = today >= trip.startDate && today <= trip.endDate;
  const projectedTotal = inProgress ? round2((totalSpent / elapsed) * days) : totalSpent;

  const summary = {
    totalBudget,
    totalSpent,
    remaining: round2(totalBudget - totalSpent),
    utilization: totalBudget ? round2((totalSpent / totalBudget) * 100) : 0,
    dailyAverage: round2(totalSpent / days),
    days,
    expenseCount: totals.count,
    largestExpense: round2(totals.largest),
    projectedTotal,
    plannedCosts: {
      transports: round2(planned.transports),
      insurances: round2(planned.insurances),
      itinerary: round2(planned.itinerary)
    }
  };

  const categoryTotalsList = byCategory.map((c) => ({
    ...c,
    total: round2(c.total),
    share: totalSpent ? round2((c.total / totalSpent) * 100) : 0
  }));

  const autoAlerts = buildAutoAlerts({
    summary,
    categoryTotals: categoryTotalsList,
    hasBudget: Boolean(budget),
    dailyBudget: budget?.dailyBudget
  });

  const manualAlerts = repo.list("alerts", { tripId, limit: 5 }).rows;

  return {
    trip,
    budget: budget || null,
    summary,
    // formato objeto mantido para compatibilidade com o frontend do CP1
    categoryTotals: Object.fromEntries(categoryTotalsList.map((c) => [c.category, c.total])),
    categories: categoryTotalsList,
    dailySpending: daily.map((d) => ({ ...d, total: round2(d.total) })),
    itinerary: repo.list("itinerary", { tripId, limit: 3, sort: "date" }).rows,
    transports: repo.list("transports", { tripId, limit: 10 }).rows,
    insurances: repo.list("insurances", { tripId, limit: 10 }).rows,
    alerts: [...autoAlerts, ...manualAlerts],
    expenses: repo.list("expenses", { tripId, limit: 5, sort: "-date" }).rows,
    goals: repo.list("goals", { limit: 10 }).rows
  };
}

/** Visão consolidada de todas as viagens em uma única consulta (evita N requisições no frontend). */
function getOverview() {
  return getDb().prepare(`
    SELECT t.id, t.name, t.destination, t.status, t.start_date AS "startDate", t.end_date AS "endDate",
           COALESCE(b.total_budget, 0) AS "totalBudget",
           COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.trip_id = t.id), 0) AS "totalSpent",
           (SELECT COUNT(*) FROM expenses e WHERE e.trip_id = t.id) AS "expenseCount"
    FROM trips t LEFT JOIN budgets b ON b.trip_id = t.id
    ORDER BY t.start_date`).all().map((r) => ({
    ...r,
    remaining: round2(r.totalBudget - r.totalSpent),
    utilization: r.totalBudget ? round2((r.totalSpent / r.totalBudget) * 100) : 0
  }));
}

module.exports = { getTripDashboard, getOverview, buildAutoAlerts };
