const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return NaN;
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Valida e normaliza o corpo de uma requisição a partir da configuração do recurso.
 * @param {object} cfg       configuração do recurso (src/resources.js)
 * @param {object} body      corpo recebido
 * @param {object} opts      { partial: true } para atualizações parciais
 * @returns {{ values: object, errors: Array<{field:string,message:string}> }}
 */
function validate(cfg, body, { partial = false } = {}) {
  const errors = [];
  const values = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { values, errors: [{ field: "body", message: "O corpo deve ser um objeto JSON." }] };
  }

  for (const [field, spec] of Object.entries(cfg.fields)) {
    let value = body[field];

    if (isEmpty(value)) {
      if (!partial && spec.required) errors.push({ field, message: "Campo obrigatório." });
      else if (!partial && spec.default !== undefined) values[field] = spec.default;
      else if (partial && value === null && !spec.required) values[field] = null;
      else if (partial && value !== undefined && spec.required) errors.push({ field, message: "Campo obrigatório não pode ser vazio." });
      continue;
    }

    switch (spec.type) {
      case "string":
      case "email": {
        if (typeof value !== "string") { errors.push({ field, message: "Deve ser texto." }); break; }
        value = value.trim();
        if (spec.maxLength && value.length > spec.maxLength) {
          errors.push({ field, message: `Máximo de ${spec.maxLength} caracteres.` }); break;
        }
        if (spec.type === "email" && !EMAIL_RE.test(value)) { errors.push({ field, message: "E-mail inválido." }); break; }
        if (spec.pattern && !spec.pattern.test(value)) { errors.push({ field, message: "Formato inválido." }); break; }
        values[field] = spec.type === "email" ? value.toLowerCase() : value;
        break;
      }
      case "number":
      case "integer": {
        const n = toNumber(value);
        if (!Number.isFinite(n)) { errors.push({ field, message: "Deve ser numérico." }); break; }
        if (spec.type === "integer" && !Number.isInteger(n)) { errors.push({ field, message: "Deve ser um número inteiro." }); break; }
        if (spec.min !== undefined && n < spec.min) { errors.push({ field, message: `Deve ser maior ou igual a ${spec.min}.` }); break; }
        if (spec.max !== undefined && n > spec.max) { errors.push({ field, message: `Deve ser menor ou igual a ${spec.max}.` }); break; }
        values[field] = spec.type === "number" ? Math.round(n * 100) / 100 : n;
        break;
      }
      case "ref": {
        const n = toNumber(value);
        if (!Number.isInteger(n) || n <= 0) { errors.push({ field, message: "Deve ser um ID inteiro positivo." }); break; }
        values[field] = n;
        break;
      }
      case "date": {
        if (!isValidDate(value)) { errors.push({ field, message: "Data inválida. Use o formato AAAA-MM-DD." }); break; }
        values[field] = value;
        break;
      }
      case "enum": {
        if (!spec.values.includes(value)) {
          errors.push({ field, message: `Valor inválido. Permitidos: ${spec.values.join(", ")}.` }); break;
        }
        values[field] = value;
        break;
      }
      case "category": {
        if (typeof value !== "string") { errors.push({ field, message: "Informe o nome da categoria." }); break; }
        values[field] = value.trim();
        break;
      }
      default:
        values[field] = value;
    }
  }

  return { values, errors };
}

/** Aplica regras de negócio que envolvem mais de um campo (ex.: datas da viagem). */
function applyRules(cfg, row) {
  return (cfg.rules || []).map((rule) => rule(row)).filter(Boolean);
}

module.exports = { validate, applyRules, isValidDate };
