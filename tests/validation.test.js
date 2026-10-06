const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
require("./setup");
const { validate, applyRules, isValidDate } = require("../src/validation");
const { resources } = require("../src/resources");

describe("Validação (unitário)", () => {
  test("datas inválidas são rejeitadas", () => {
    assert.equal(isValidDate("2025-06-01"), true);
    assert.equal(isValidDate("2025-02-30"), false);
    assert.equal(isValidDate("01/06/2025"), false);
  });

  test("campos obrigatórios ausentes geram erro por campo", () => {
    const { errors } = validate(resources.expenses, {});
    const fields = errors.map((e) => e.field).sort();
    assert.deepEqual(fields, ["amount", "category", "date", "description", "tripId"]);
  });

  test("converte números enviados como texto e arredonda para 2 casas", () => {
    const { values, errors } = validate(resources.expenses, {
      tripId: "1", category: "Alimentação", description: "  Jantar  ", amount: "10.456", date: "2025-06-01"
    });
    assert.equal(errors.length, 0);
    assert.equal(values.tripId, 1);
    assert.equal(values.amount, 10.46);
    assert.equal(values.description, "Jantar");
  });

  test("valor negativo e enum inválido são rejeitados", () => {
    assert.ok(validate(resources.expenses, { tripId: 1, category: "X", description: "a", amount: -5, date: "2025-06-01" })
      .errors.some((e) => e.field === "amount"));
    assert.ok(validate(resources.alerts, { tripId: 1, type: "urgente", title: "a", message: "b" })
      .errors.some((e) => e.field === "type"));
  });

  test("e-mail é validado e normalizado", () => {
    assert.ok(validate(resources.users, { name: "A", email: "invalido" }).errors.length);
    assert.equal(validate(resources.users, { name: "A", email: "Ana@Mail.COM" }).values.email, "ana@mail.com");
  });

  test("validação parcial aceita apenas os campos enviados", () => {
    const { values, errors } = validate(resources.trips, { travelers: 3 }, { partial: true });
    assert.equal(errors.length, 0);
    assert.deepEqual(values, { travelers: 3 });
  });

  test("regra de negócio: término antes do início", () => {
    const problems = applyRules(resources.trips, { startDate: "2025-06-10", endDate: "2025-06-01" });
    assert.equal(problems[0].field, "endDate");
  });
});
