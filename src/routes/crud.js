const express = require("express");
const repo = require("../repository");
const { resources } = require("../resources");
const { validate } = require("../validation");
const { errors, asyncHandler, ok } = require("../errors");
const ai = require("../services/ai");

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw errors.badRequest("INVALID_ID", "ID deve ser um número inteiro positivo.");
  return id;
}

/**
 * Gera as rotas REST de um recurso:
 * GET /, GET /:id, POST /, PUT /:id (atualização parcial), PATCH /:id, DELETE /:id
 */
function crudRouter(name) {
  const cfg = resources[name];
  const router = express.Router();

  router.get("/", (req, res) => {
    const { rows, meta } = repo.list(name, req.query);
    ok(res, rows, 200, meta);
  });

  router.get("/:id", (req, res) => {
    ok(res, repo.getOrFail(name, parseId(req.params.id)));
  });

  router.post("/", asyncHandler(async (req, res) => {
    const body = { ...(req.body || {}) };
    let meta;

    // Regra de negócio com IA: despesa sem categoria (ou "auto") é classificada automaticamente
    if (name === "expenses" && body.description && (!body.category || body.category === "auto")) {
      const suggestion = await ai.classifyExpense({ description: body.description, amount: body.amount });
      body.category = suggestion.category;
      meta = { categorizedBy: suggestion.source, confidence: suggestion.confidence, model: suggestion.model };
    }

    const { values, errors: problems } = validate(cfg, body);
    if (problems.length) throw errors.validation(problems);
    ok(res, repo.create(name, values), 201, meta);
  }));

  const update = (req, res) => {
    const id = parseId(req.params.id);
    const { values, errors: problems } = validate(cfg, req.body, { partial: true });
    if (problems.length) throw errors.validation(problems);
    ok(res, repo.update(name, id, values));
  };
  router.put("/:id", update);
  router.patch("/:id", update);

  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    repo.remove(name, id);
    ok(res, { id, deleted: true });
  });

  return router;
}

module.exports = { crudRouter, parseId };
