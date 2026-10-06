const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const { errors, asyncHandler, ok } = require("../errors");
const { getTripDashboard, getOverview } = require("../services/dashboard");
const ai = require("../services/ai");
const llm = require("../services/llm");
const { parseId } = require("./crud");

const router = express.Router();

// ---------- Dashboard ----------
router.get("/dashboard", (req, res) => {
  const tripId = req.query.tripId !== undefined ? parseId(req.query.tripId) : 1;
  ok(res, getTripDashboard(tripId));
});

router.get("/trips/:id/dashboard", (req, res) => {
  ok(res, getTripDashboard(parseId(req.params.id)));
});

router.get("/overview", (_req, res) => {
  ok(res, getOverview());
});

// ---------- IA (LLM) ----------
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.aiPerMinute,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Muitas requisições de IA. Aguarde um minuto." } })
});

router.get("/ai/status", (_req, res) => ok(res, llm.status()));

router.post("/ai/classify-expense", aiLimiter, asyncHandler(async (req, res) => {
  const { description, amount } = req.body || {};
  if (typeof description !== "string" || !description.trim()) {
    throw errors.validation([{ field: "description", message: "Informe a descrição da despesa." }]);
  }
  if (description.length > 200) {
    throw errors.validation([{ field: "description", message: "Máximo de 200 caracteres." }]);
  }
  ok(res, await ai.classifyExpense({ description, amount }));
}));

const insightsHandler = asyncHandler(async (req, res) => {
  const tripId = parseId(req.params.id ?? req.query.tripId);
  ok(res, await ai.tripInsights(tripId, { force: req.query.refresh === "true" }));
});
router.get("/ai/insights", aiLimiter, insightsHandler);
router.get("/trips/:id/insights", aiLimiter, insightsHandler);

module.exports = router;
