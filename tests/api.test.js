const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { request, resetDb } = require("./setup");

const newExpense = (over = {}) => ({
  tripId: 1, category: "Alimentação", description: "Café da manhã", amount: 42.5, date: "2025-06-02", ...over
});

describe("API REST (integração)", () => {
  beforeEach(() => resetDb());

  test("GET /api/health responde online com banco ok", async () => {
    const res = await request().get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.database, "ok");
  });

  describe("Listagem: paginação, filtros e ordenação", () => {
    test("retorna meta de paginação", async () => {
      const res = await request().get("/api/expenses?limit=3&page=2");
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 3);
      assert.deepEqual(
        { page: res.body.meta.page, limit: res.body.meta.limit, total: res.body.meta.total },
        { page: 2, limit: 3, total: 10 }
      );
      assert.equal(res.body.meta.totalPages, 4);
    });

    test("filtra por categoria, viagem e faixa de valor", async () => {
      const res = await request().get("/api/expenses?tripId=1&category=Transporte&minAmount=100");
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length > 0);
      for (const e of res.body.data) {
        assert.equal(e.category, "Transporte");
        assert.ok(e.amount >= 100);
      }
    });

    test("ordena por valor decrescente", async () => {
      const { body } = await request().get("/api/expenses?sort=-amount&limit=100");
      const amounts = body.data.map((e) => e.amount);
      assert.deepEqual(amounts, [...amounts].sort((a, b) => b - a));
    });

    test("busca textual por descrição", async () => {
      const { body } = await request().get("/api/expenses?search=hotel");
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].description, "Hotel");
    });

    test("ordenação ou paginação inválidas retornam 400", async () => {
      assert.equal((await request().get("/api/expenses?sort=senha")).status, 400);
      assert.equal((await request().get("/api/expenses?limit=0")).status, 400);
      assert.equal((await request().get("/api/expenses?tripId=abc")).status, 400);
    });

    test("limit é limitado a 100", async () => {
      const { body } = await request().get("/api/expenses?limit=5000");
      assert.equal(body.meta.limit, 100);
    });
  });

  describe("CRUD de despesas", () => {
    test("cria despesa válida (201) com categoria normalizada", async () => {
      const res = await request().post("/api/expenses").send(newExpense());
      assert.equal(res.status, 201);
      assert.equal(res.body.data.category, "Alimentação");
      assert.ok(res.body.data.categoryId);
      assert.ok(res.body.data.createdAt);
    });

    test("dados inválidos retornam 400 com detalhes por campo", async () => {
      const res = await request().post("/api/expenses").send(newExpense({ amount: -1, date: "2025-99-01" }));
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "VALIDATION_ERROR");
      assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ["amount", "date"]);
    });

    test("viagem ou categoria inexistente retorna 422", async () => {
      const res = await request().post("/api/expenses").send(newExpense({ tripId: 999, category: "Cassino" }));
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, "REFERENCE_ERROR");
      assert.equal(res.body.error.details.length, 2);
    });

    test("PUT altera somente os campos enviados", async () => {
      const res = await request().put("/api/expenses/2").send({ amount: 99.9 });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.amount, 99.9);
      assert.equal(res.body.data.description, "Almoço - Restaurante");
    });

    test("DELETE remove e GET seguinte retorna 404", async () => {
      assert.equal((await request().delete("/api/expenses/1")).status, 200);
      const res = await request().get("/api/expenses/1");
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, "NOT_FOUND");
    });

    test("ID inválido retorna 400", async () => {
      assert.equal((await request().get("/api/expenses/abc")).status, 400);
    });
  });

  describe("Regras de negócio e integridade", () => {
    test("viagem com término antes do início retorna 422", async () => {
      const res = await request().post("/api/trips").send({ name: "X", startDate: "2025-06-10", endDate: "2025-06-01" });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, "BUSINESS_RULE");
    });

    test("regra também vale em atualização parcial", async () => {
      const res = await request().patch("/api/trips/1").send({ endDate: "2025-05-01" });
      assert.equal(res.status, 422);
    });

    test("apenas um orçamento por viagem (409)", async () => {
      const res = await request().post("/api/budgets").send({ tripId: 1, totalBudget: 100 });
      assert.equal(res.status, 409);
    });

    test("e-mail duplicado retorna 409", async () => {
      const res = await request().post("/api/users").send({ name: "Outra", email: "GIOVANNA@travelcash.local" });
      assert.equal(res.status, 409);
    });

    test("categoria em uso não pode ser excluída (409)", async () => {
      const res = await request().delete("/api/categories/1");
      assert.equal(res.status, 409);
    });

    test("excluir viagem remove despesas em cascata", async () => {
      assert.equal((await request().delete("/api/trips/1")).status, 200);
      const { body } = await request().get("/api/expenses?tripId=1");
      assert.equal(body.meta.total, 0);
    });

    test("progresso da meta é calculado (não armazenado)", async () => {
      const { body } = await request().patch("/api/goals/1").send({ currentAmount: 7500 });
      assert.equal(body.data.progress, 50);
    });
  });

  describe("Tratamento de erros", () => {
    test("JSON malformado retorna 400 INVALID_JSON", async () => {
      const res = await request().post("/api/trips").set("Content-Type", "application/json").send("{ruim");
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "INVALID_JSON");
    });

    test("rota inexistente retorna 404 padronizado", async () => {
      const res = await request().get("/api/naoexiste");
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    test("cabeçalhos de segurança presentes (helmet)", async () => {
      const res = await request().get("/api/health");
      assert.ok(res.headers["x-content-type-options"]);
      assert.equal(res.headers["x-powered-by"], undefined);
    });

    test("Swagger disponível", async () => {
      const res = await request().get("/api/openapi.json");
      assert.equal(res.status, 200);
      assert.ok(res.body.paths["/api/expenses"]);
    });
  });
});
