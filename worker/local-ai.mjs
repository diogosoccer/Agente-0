const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/,"");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";
const OLLAMA_FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || "qwen3.5:4b";

async function ollamaFetch(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(OLLAMA_URL + path, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function listModels() {
  const response = await ollamaFetch("/api/tags", {}, 2500);
  if (!response.ok) throw new Error("Ollama respondeu com erro.");
  const data = await response.json();
  return Array.isArray(data?.models) ? data.models.map(model => model?.name).filter(Boolean) : [];
}

function installedName(models) {
  if (models.some(name => name === OLLAMA_MODEL || name.startsWith(OLLAMA_MODEL.split(":")[0] + ":"))) return OLLAMA_MODEL;
  if (models.some(name => name === OLLAMA_FALLBACK_MODEL || name.startsWith(OLLAMA_FALLBACK_MODEL.split(":")[0] + ":"))) return OLLAMA_FALLBACK_MODEL;
  return null;
}

export async function localAIStatus() {
  try {
    const models = await listModels();
    const activeModel = installedName(models);
    return {
      available: true,
      provider: "ollama",
      url: OLLAMA_URL,
      model: activeModel || OLLAMA_MODEL,
      preferredModel: OLLAMA_MODEL,
      fallbackModel: OLLAMA_FALLBACK_MODEL,
      modelInstalled: Boolean(activeModel),
      models,
      message: activeModel ? "IA local pronta." : "Ollama está instalado, mas nenhum modelo JARVIS foi baixado."
    };
  } catch {
    return {
      available: false,
      provider: "ollama",
      url: OLLAMA_URL,
      model: OLLAMA_MODEL,
      preferredModel: OLLAMA_MODEL,
      fallbackModel: OLLAMA_FALLBACK_MODEL,
      modelInstalled: false,
      models: [],
      message: "Ollama não foi encontrado em execução."
    };
  }
}

export async function generateLocalText(system, user, maxTokens = 900) {
  const status = await localAIStatus();
  if (!status.available) throw new Error("Ollama indisponível.");
  const model = status.modelInstalled ? status.model : OLLAMA_MODEL;
  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      options: { num_predict: maxTokens, temperature: 0.35 }
    })
  }, 120000);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Falha no modelo local.");
  }
  const data = await response.json();
  const text = data?.message?.content?.trim();
  if (!text) throw new Error("O modelo local não retornou texto.");
  return text;
}

export async function generateLocalVision(system, user, imageBase64, maxTokens = 500) {
  const status = await localAIStatus();
  if (!status.available || !status.modelInstalled) throw new Error("IA local de visão indisponível.");
  const model = status.model;
  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "system", content: system }, { role: "user", content: user, images: [imageBase64] }],
      options: { num_predict: maxTokens, temperature: 0.2 }
    })
  }, 120000);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Falha no modelo local de visão.");
  }
  const data = await response.json();
  const text = data?.message?.content?.trim();
  if (!text) throw new Error("O modelo local não retornou uma análise visual.");
  return text;
}

export async function ensureLocalModel() { return localAIStatus(); }
export { OLLAMA_MODEL, OLLAMA_FALLBACK_MODEL, OLLAMA_URL };