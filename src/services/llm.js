/**
 * Cliente mínimo de LLM (sem SDK) com suporte a dois provedores:
 *  - Google Gemini (padrão — possui camada gratuita)  → GEMINI_API_KEY
 *  - Anthropic Claude                                  → ANTHROPIC_API_KEY
 * Sem chave configurada, provider = "none" e os serviços usam regras locais (fallback).
 */
const config = require("../config");

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4-5"
};

class LLMError extends Error {}

function status() {
  const { provider } = config.llm;
  const configured =
    (provider === "gemini" && Boolean(config.llm.geminiKey)) ||
    (provider === "anthropic" && Boolean(config.llm.anthropicKey));
  return {
    provider: configured ? provider : "none",
    model: configured ? config.llm.model || DEFAULT_MODELS[provider] : null,
    configured
  };
}

/** Extrai o primeiro objeto JSON de um texto (modelos às vezes envolvem em ```json). */
function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new LLMError("Resposta do modelo não contém JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

async function post(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new LLMError(`Provedor respondeu ${res.status}: ${json?.error?.message || "erro desconhecido"}`);
    return json;
  } catch (err) {
    if (err.name === "AbortError") throw new LLMError("Tempo limite excedido ao consultar o modelo.");
    throw err instanceof LLMError ? err : new LLMError(err.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia um prompt e devolve o JSON gerado pelo modelo.
 * @returns {Promise<{ data: object, model: string, provider: string }>}
 */
async function completeJson({ system, prompt, maxTokens = 800 }) {
  const st = status();
  if (!st.configured) throw new LLMError("Nenhum provedor de LLM configurado.");

  if (st.provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${st.model}:generateContent`;
    const json = await post(url, { "x-goog-api-key": config.llm.geminiKey }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: "application/json" }
    });
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    return { data: parseJson(text), model: st.model, provider: st.provider };
  }

  const json = await post("https://api.anthropic.com/v1/messages", {
    "x-api-key": config.llm.anthropicKey,
    "anthropic-version": "2023-06-01"
  }, {
    model: st.model,
    max_tokens: maxTokens,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: prompt }]
  });
  const text = (json?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { data: parseJson(text), model: st.model, provider: st.provider };
}

module.exports = { completeJson, status, LLMError, DEFAULT_MODELS };
