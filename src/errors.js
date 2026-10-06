/** Erro de aplicação com status HTTP e código padronizado. */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const errors = {
  badRequest: (code, message, details) => new AppError(400, code, message, details),
  validation: (details) => new AppError(400, "VALIDATION_ERROR", "Dados inválidos na requisição.", details),
  notFound: (message = "Recurso não encontrado.") => new AppError(404, "NOT_FOUND", message),
  conflict: (message, details) => new AppError(409, "CONFLICT", message, details),
  unprocessable: (code, message, details) => new AppError(422, code, message, details)
};

/** Envolve handlers async para que erros cheguem ao middleware de erro. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Respostas padronizadas */
function ok(res, data, status = 200, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function fail(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) }
  });
}

module.exports = { AppError, errors, asyncHandler, ok, fail };
