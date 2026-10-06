/**
 * Gera docs/openapi.yaml a partir da configuração dos recursos (src/resources.js).
 * Assim o Swagger nunca fica desatualizado em relação às validações da API.
 *   npm run docs:generate
 */
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { resources } = require("../src/resources");

const EXAMPLES = {
  users: { name: "Giovanna Pereira", email: "giovanna@travelcash.local", avatar: "GP" },
  trips: { name: "Orlando - Férias 2025", destination: "Orlando, EUA", startDate: "2025-06-01", endDate: "2025-06-15", travelers: 2, status: "Em andamento" },
  budgets: { tripId: 2, totalBudget: 15000, dailyBudget: 300 },
  categories: { name: "Saúde", color: "#22aa88" },
  expenses: { tripId: 1, category: "Alimentação", description: "Jantar no restaurante", amount: 120.5, date: "2025-06-03" },
  itinerary: { tripId: 1, date: "2025-06-04", title: "Magic Kingdom", location: "Walt Disney World", estimatedCost: 680 },
  transports: { tripId: 1, type: "Passagem aérea", description: "Ida e volta GRU-MCO", amount: 1200 },
  insurances: { tripId: 1, provider: "TravelSafe", coverage: "Viagem internacional", amount: 180 },
  goals: { name: "Viagem Europa 2026", targetAmount: 15000, currentAmount: 6250 },
  alerts: { tripId: 1, type: "warning", title: "Orçamento em 80%", message: "Reveja os gastos de alimentação" }
};

const TAGS = {
  users: "Usuários", trips: "Viagens", budgets: "Orçamentos", categories: "Categorias", expenses: "Despesas",
  itinerary: "Roteiro", transports: "Transportes", insurances: "Seguros", goals: "Metas", alerts: "Alertas"
};

function fieldSchema(spec) {
  switch (spec.type) {
    case "string": return { type: "string", ...(spec.maxLength ? { maxLength: spec.maxLength } : {}) };
    case "email": return { type: "string", format: "email", maxLength: spec.maxLength };
    case "number": return { type: "number", ...(spec.min !== undefined ? { minimum: spec.min } : {}), ...(spec.max !== undefined ? { maximum: spec.max } : {}) };
    case "integer": return { type: "integer", ...(spec.min !== undefined ? { minimum: spec.min } : {}), ...(spec.max !== undefined ? { maximum: spec.max } : {}) };
    case "date": return { type: "string", format: "date", example: "2025-06-01" };
    case "enum": return { type: "string", enum: spec.values };
    case "ref": return { type: "integer", minimum: 1, description: `ID de ${resources[spec.ref].label.toLowerCase()} (FK)` };
    case "category": return { type: "string", description: "Nome da categoria (GET /api/categories). Em POST, omitir ou enviar \"auto\" faz a IA classificar." };
    default: return { type: "string" };
  }
}

const doc = {
  openapi: "3.0.3",
  info: {
    title: "TravelCash API",
    version: "2.0.0",
    description: [
      "API REST do **TravelCash — Controle Financeiro para Viagens** (FIAP • CP2).",
      "",
      "**Padrão de resposta**: `{ success, data, meta? }` em sucesso e `{ success:false, error:{ code, message, details? } }` em erro.",
      "",
      "**Listagens** aceitam `page`, `limit` (máx. 100, padrão 20), `sort` (prefixo `-` = decrescente) e `search`; filtros específicos de cada recurso estão descritos nos parâmetros.",
      "",
      "**IA (LLM)**: endpoints em *IA* usam Gemini ou Claude quando há chave configurada; caso contrário respondem com regras locais (`source: \"regras\"`)."
    ].join("\n")
  },
  servers: [{ url: "/", description: "Servidor atual" }],
  tags: [
    { name: "Sistema" }, { name: "Dashboard" }, { name: "IA", description: "Funcionalidades baseadas em LLM" },
    ...Object.values(TAGS).map((name) => ({ name }))
  ],
  paths: {},
  components: {
    parameters: {
      id: { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
      page: { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      limit: { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
      search: { name: "search", in: "query", description: "Busca textual (LIKE)", schema: { type: "string" } },
      tripId: { name: "tripId", in: "query", description: "Filtra pela viagem", schema: { type: "integer", minimum: 1 } }
    },
    schemas: {
      Meta: {
        type: "object",
        properties: { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" }, sort: { type: "string" } }
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Dados inválidos na requisição." },
              details: { type: "array", items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } } }
            }
          }
        }
      },
      Insights: {
        type: "object",
        properties: {
          tripId: { type: "integer" },
          source: { type: "string", enum: ["llm", "regras"] },
          model: { type: "string", nullable: true, example: "gemini-2.5-flash" },
          cached: { type: "boolean" },
          generatedAt: { type: "string", format: "date-time" },
          fallbackReason: { type: "string" },
          dataSent: { type: "object", description: "Dados agregados enviados ao modelo (sem dados pessoais)" },
          insights: {
            type: "object",
            properties: {
              resumo: { type: "string" },
              saude: { type: "string", enum: ["boa", "atencao", "critica"] },
              pontosDeAtencao: { type: "array", items: { type: "string" } },
              recomendacoes: { type: "array", items: { type: "string" } },
              previsao: { type: "string" }
            }
          }
        }
      },
      Classification: {
        type: "object",
        properties: {
          category: { type: "string", example: "Alimentação" },
          confidence: { type: "number", example: 0.92 },
          reason: { type: "string", example: "Refeição em restaurante." },
          source: { type: "string", enum: ["llm", "regras"] },
          model: { type: "string", nullable: true }
        }
      }
    },
    responses: {
      BadRequest: { description: "Requisição inválida (validação/JSON/parâmetros)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      NotFound: { description: "Não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Conflict: { description: "Conflito (duplicidade ou registro em uso)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Unprocessable: { description: "Regra de negócio ou referência inválida", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      RateLimited: { description: "Limite de requisições excedido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
    }
  }
};

const ok = (schema, description = "OK", withMeta = false) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: { success: { type: "boolean", example: true }, data: schema, ...(withMeta ? { meta: { $ref: "#/components/schemas/Meta" } } : {}) }
      }
    }
  }
});

for (const [name, cfg] of Object.entries(resources)) {
  const props = { id: { type: "integer", readOnly: true } };
  const required = [];
  for (const [field, spec] of Object.entries(cfg.fields)) {
    props[field] = fieldSchema(spec);
    if (spec.required) required.push(field);
  }
  if (cfg.timestamps !== false) {
    props.createdAt = { type: "string", format: "date-time", readOnly: true };
    props.updatedAt = { type: "string", format: "date-time", readOnly: true };
  }
  if (name === "expenses") Object.assign(props, { categoryId: { type: "integer", readOnly: true }, categoryColor: { type: "string", readOnly: true } });
  if (name === "goals") props.progress = { type: "number", readOnly: true, description: "Calculado (currentAmount / targetAmount)" };

  const schemaName = name[0].toUpperCase() + name.slice(1);
  doc.components.schemas[schemaName] = { type: "object", required, properties: props, example: { id: 1, ...EXAMPLES[name] } };
  doc.components.schemas[`${schemaName}Input`] = {
    type: "object",
    required: name === "expenses" ? required.filter((r) => r !== "category") : required,
    properties: Object.fromEntries(Object.entries(props).filter(([, v]) => !v.readOnly && v !== props.id)),
    example: EXAMPLES[name]
  };
  const ref = { $ref: `#/components/schemas/${schemaName}` };
  const inputRef = { $ref: `#/components/schemas/${schemaName}Input` };
  const tag = TAGS[name];

  const listParams = [{ $ref: "#/components/parameters/page" }, { $ref: "#/components/parameters/limit" }];
  listParams.push({
    name: "sort", in: "query",
    description: `Campos: ${[...(cfg.sortable || []), ...Object.keys(cfg.sortExtra || {}), "id"].join(", ")}. Prefixo "-" = decrescente.`,
    schema: { type: "string", default: cfg.defaultSort }
  });
  if (cfg.search?.length) listParams.push({ $ref: "#/components/parameters/search" });
  if (cfg.fields.tripId) listParams.push({ $ref: "#/components/parameters/tripId" });
  for (const key of Object.keys(cfg.filters || {})) {
    const spec = cfg.fields[key];
    listParams.push({ name: key, in: "query", schema: spec ? fieldSchema(spec) : { type: key.endsWith("Id") ? "integer" : "string" } });
  }
  if (cfg.dateFilter) listParams.push(
    { name: "dateFrom", in: "query", schema: { type: "string", format: "date" } },
    { name: "dateTo", in: "query", schema: { type: "string", format: "date" } }
  );
  if (cfg.amountFilter) listParams.push(
    { name: "minAmount", in: "query", schema: { type: "number" } },
    { name: "maxAmount", in: "query", schema: { type: "number" } }
  );

  doc.paths[`/api/${name}`] = {
    get: {
      tags: [tag], summary: `Listar ${tag.toLowerCase()} (paginado)`, parameters: listParams,
      responses: { 200: ok({ type: "array", items: ref }, "Lista paginada", true), 400: { $ref: "#/components/responses/BadRequest" } }
    },
    post: {
      tags: [tag], summary: `Criar ${cfg.label.toLowerCase()}`,
      ...(name === "expenses" ? { description: "Se `category` for omitida ou `\"auto\"`, a IA classifica a despesa e `meta.categorizedBy` indica a origem (llm ou regras)." } : {}),
      requestBody: { required: true, content: { "application/json": { schema: inputRef } } },
      responses: {
        201: ok(ref, "Criado"), 400: { $ref: "#/components/responses/BadRequest" },
        409: { $ref: "#/components/responses/Conflict" }, 422: { $ref: "#/components/responses/Unprocessable" }
      }
    }
  };
  const updateOp = (method) => ({
    tags: [tag], summary: `${method === "put" ? "Atualizar" : "Atualizar parcialmente"} ${cfg.label.toLowerCase()}`,
    description: "Somente os campos enviados são alterados.",
    parameters: [{ $ref: "#/components/parameters/id" }],
    requestBody: { required: true, content: { "application/json": { schema: { ...inputRef } } } },
    responses: {
      200: ok(ref), 400: { $ref: "#/components/responses/BadRequest" }, 404: { $ref: "#/components/responses/NotFound" },
      409: { $ref: "#/components/responses/Conflict" }, 422: { $ref: "#/components/responses/Unprocessable" }
    }
  });
  doc.paths[`/api/${name}/{id}`] = {
    get: {
      tags: [tag], summary: `Buscar ${cfg.label.toLowerCase()} por id`, parameters: [{ $ref: "#/components/parameters/id" }],
      responses: { 200: ok(ref), 400: { $ref: "#/components/responses/BadRequest" }, 404: { $ref: "#/components/responses/NotFound" } }
    },
    put: updateOp("put"),
    patch: updateOp("patch"),
    delete: {
      tags: [tag], summary: `Excluir ${cfg.label.toLowerCase()}`, parameters: [{ $ref: "#/components/parameters/id" }],
      responses: {
        200: ok({ type: "object", properties: { id: { type: "integer" }, deleted: { type: "boolean" } } }),
        404: { $ref: "#/components/responses/NotFound" }, 409: { $ref: "#/components/responses/Conflict" }
      }
    }
  };
}

const dashboardSchema = {
  type: "object",
  properties: {
    trip: { $ref: "#/components/schemas/Trips" },
    budget: { $ref: "#/components/schemas/Budgets" },
    summary: {
      type: "object",
      properties: Object.fromEntries(["totalBudget", "totalSpent", "remaining", "utilization", "dailyAverage", "days", "expenseCount", "largestExpense", "projectedTotal"].map((k) => [k, { type: "number" }]))
    },
    categories: { type: "array", items: { type: "object", properties: { category: { type: "string" }, color: { type: "string" }, total: { type: "number" }, share: { type: "number" }, count: { type: "integer" } } } },
    categoryTotals: { type: "object", additionalProperties: { type: "number" }, description: "Formato legado (CP1)" },
    dailySpending: { type: "array", items: { type: "object", properties: { date: { type: "string", format: "date" }, total: { type: "number" }, count: { type: "integer" } } } },
    alerts: { type: "array", description: "Alertas automáticos (auto=true, calculados por regras) + manuais", items: { type: "object" } },
    expenses: { type: "array", items: { $ref: "#/components/schemas/Expenses" } },
    itinerary: { type: "array", items: { $ref: "#/components/schemas/Itinerary" } },
    goals: { type: "array", items: { $ref: "#/components/schemas/Goals" } }
  }
};

Object.assign(doc.paths, {
  "/api/health": { get: { tags: ["Sistema"], summary: "Status da API e do banco", responses: { 200: ok({ type: "object" }) } } },
  "/api/dashboard": {
    get: {
      tags: ["Dashboard"], summary: "Dashboard consolidado de uma viagem",
      description: "Indicadores, gastos por categoria, evolução diária, projeção e alertas automáticos — agregados em SQL.",
      parameters: [{ ...{ name: "tripId", in: "query", schema: { type: "integer", minimum: 1, default: 1 } } }],
      responses: { 200: ok(dashboardSchema), 404: { $ref: "#/components/responses/NotFound" } }
    }
  },
  "/api/trips/{id}/dashboard": {
    get: { tags: ["Dashboard"], summary: "Dashboard da viagem (rota REST)", parameters: [{ $ref: "#/components/parameters/id" }], responses: { 200: ok(dashboardSchema), 404: { $ref: "#/components/responses/NotFound" } } }
  },
  "/api/overview": {
    get: {
      tags: ["Dashboard"], summary: "Resumo de todas as viagens em uma única consulta",
      responses: { 200: ok({ type: "array", items: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, totalBudget: { type: "number" }, totalSpent: { type: "number" }, remaining: { type: "number" }, utilization: { type: "number" } } } }) }
    }
  },
  "/api/ai/status": { get: { tags: ["IA"], summary: "Provedor/modelo de LLM configurado", responses: { 200: ok({ type: "object", properties: { provider: { type: "string" }, model: { type: "string", nullable: true }, configured: { type: "boolean" } } }) } } },
  "/api/ai/classify-expense": {
    post: {
      tags: ["IA"], summary: "Sugerir categoria de uma despesa (LLM)",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["description"], properties: { description: { type: "string", maxLength: 200 }, amount: { type: "number" } } }, example: { description: "Uber até o aeroporto", amount: 85 } } } },
      responses: { 200: ok({ $ref: "#/components/schemas/Classification" }), 400: { $ref: "#/components/responses/BadRequest" }, 429: { $ref: "#/components/responses/RateLimited" } }
    }
  },
  "/api/trips/{id}/insights": {
    get: {
      tags: ["IA"], summary: "Análise financeira da viagem gerada por LLM",
      description: "Envia ao modelo apenas números agregados (sem nome/e-mail). Respostas ficam em cache por 10 min; use `refresh=true` para forçar nova geração.",
      parameters: [{ $ref: "#/components/parameters/id" }, { name: "refresh", in: "query", schema: { type: "boolean" } }],
      responses: { 200: ok({ $ref: "#/components/schemas/Insights" }), 404: { $ref: "#/components/responses/NotFound" }, 429: { $ref: "#/components/responses/RateLimited" } }
    }
  },
  "/api/ai/insights": {
    get: {
      tags: ["IA"], summary: "Análise financeira (variação por query string)",
      parameters: [{ name: "tripId", in: "query", required: true, schema: { type: "integer", minimum: 1 } }, { name: "refresh", in: "query", schema: { type: "boolean" } }],
      responses: { 200: ok({ $ref: "#/components/schemas/Insights" }), 400: { $ref: "#/components/responses/BadRequest" }, 404: { $ref: "#/components/responses/NotFound" } }
    }
  }
});

// operationId único por operação (facilita geração de clientes) + API pública declarada explicitamente
for (const [route, item] of Object.entries(doc.paths)) {
  for (const [method, op] of Object.entries(item)) {
    const parts = route.replace("/api/", "").split("/").map((p) => (p.startsWith("{") ? "ById" : p.replace(/-(\w)/g, (_, c) => c.toUpperCase())));
    op.operationId = method + parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("");
    op.security = [];
  }
}
doc.info.license = { name: "Uso acadêmico — FIAP" };

const out = path.join(__dirname, "..", "docs", "openapi.yaml");
fs.writeFileSync(out, `# Arquivo gerado por scripts/generate-openapi.js — não edite à mão.\n${YAML.stringify(doc, { aliasDuplicateObjects: false })}`);
console.log(`OpenAPI gerado em ${path.relative(process.cwd(), out)} (${Object.keys(doc.paths).length} rotas)`);
