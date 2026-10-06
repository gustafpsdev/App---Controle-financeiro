require("dotenv").config({ quiet: true });
const path = require("path");

const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  nodeEnv: env.NODE_ENV || "development",
  dbFile: env.DB_FILE || path.join(__dirname, "..", "data", "travelcash.db"),
  seed: env.SEED_DB !== "false",
  corsOrigin: env.CORS_ORIGIN || "*",
  llm: {
    // gemini | anthropic | none  (none = usa só as regras locais de fallback)
    provider: (env.LLM_PROVIDER || (env.GEMINI_API_KEY ? "gemini" : env.ANTHROPIC_API_KEY ? "anthropic" : "none")).toLowerCase(),
    geminiKey: env.GEMINI_API_KEY || "",
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    model: env.LLM_MODEL || "",
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 15000,
    cacheTtlMs: Number(env.LLM_CACHE_TTL_MS) || 10 * 60 * 1000
  },
  rateLimit: {
    aiPerMinute: Number(env.AI_RATE_LIMIT_PER_MIN) || 20,
    apiPerMinute: Number(env.API_RATE_LIMIT_PER_MIN) || 300
  }
};
