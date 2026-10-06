const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");

const config = require("./config");
const { resources } = require("./resources");
const { crudRouter } = require("./routes/crud");
const insightsRouter = require("./routes/insights");
const { AppError, ok, fail } = require("./errors");
const { getDb } = require("./db");

const app = express();
const publicDir = path.join(__dirname, "..", "public");
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "openapi.yaml"), "utf8"));

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

// Limite geral da API (proteção contra abuso); IA tem limite próprio mais restrito
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimit.apiPerMinute,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => config.nodeEnv === "test",
  handler: (_req, res) => fail(res, 429, "RATE_LIMITED", "Muitas requisições. Tente novamente em instantes.")
}));

// Documentação
app.get("/api/openapi.json", (_req, res) => res.json(openapi));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "TravelCash API" }));

app.get("/api/health", (_req, res) => {
  const dbOk = getDb().prepare("SELECT 1 AS ok").get().ok === 1;
  ok(res, { status: "online", database: dbOk ? "ok" : "erro", timestamp: new Date().toISOString() });
});

app.use("/api", insightsRouter);
for (const name of Object.keys(resources)) {
  app.use(`/api/${name}`, crudRouter(name));
}

app.use(express.static(publicDir));

// 404 de API / fallback do frontend (SPA)
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return fail(res, 404, "ROUTE_NOT_FOUND", "Endpoint não encontrado.");
  return res.sendFile(path.join(publicDir, "index.html"));
});

// Tratamento centralizado de erros
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) return fail(res, err.status, err.code, err.message, err.details);
  if (err.type === "entity.parse.failed") return fail(res, 400, "INVALID_JSON", "JSON inválido na requisição.");
  if (err.type === "entity.too.large") return fail(res, 413, "PAYLOAD_TOO_LARGE", "Corpo da requisição muito grande.");
  if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" || /FOREIGN KEY constraint failed/.test(err.message || "")) {
    return fail(res, 409, "CONFLICT", "Registro está em uso por outros dados e não pode ser removido/alterado.");
  }
  if (typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT")) {
    return fail(res, 422, "CONSTRAINT_VIOLATION", "Os dados violam uma restrição do banco.");
  }
  if (config.nodeEnv !== "test") console.error(err);
  return fail(res, 500, "INTERNAL_ERROR", "Erro interno do servidor.");
});

module.exports = app;
