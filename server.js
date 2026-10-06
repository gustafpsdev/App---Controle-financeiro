const app = require("./src/app");
const config = require("./src/config");
const llm = require("./src/services/llm");

app.listen(config.port, () => {
  const ai = llm.status();
  console.log(`TravelCash rodando em http://localhost:${config.port}`);
  console.log(`Swagger:            http://localhost:${config.port}/api/docs`);
  console.log(`IA (LLM):           ${ai.configured ? `${ai.provider} / ${ai.model}` : "sem chave — usando regras locais"}`);
});
