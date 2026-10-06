// Ambiente isolado para testes: banco em memória, sem LLM real, sem rate limit.
process.env.NODE_ENV = "test";
process.env.DB_FILE = ":memory:";
process.env.LLM_PROVIDER = "none";
process.env.GEMINI_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";

const request = require("supertest");
const app = require("../src/app");
const { resetDb } = require("../src/db");

module.exports = { request: () => request(app), resetDb };
