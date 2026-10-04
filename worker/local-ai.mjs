const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:4b";

async function ollamaFetch(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(OLLAMA_URL + path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function localAIStatus() {
  try {
    const response = await ollamaFetch("/api/tags", {}, 2500);
    if (!response.ok) return { available: false, reason: "Ollama respondeu com erro." };
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models.map(model => model?.name).filter(Boolean) : [];
    const hasConfiguredModel = models.some(name => name === OLLAMA_MODEL || name.startsWith(OLLAMA_MODEL.split(":")[0] + ":"));
    return {
      available: true,
      provider: "ollama",
      url: OLLAMA_URL,
      model: OLLAMA_MODEL,
      modelInstalled: hasConfiguredModel,
      models,
      message: hasConfiguredModel ? "IA local pronta." : "Ollama está instalado, mas o modelo configurado ainda não foi baixado."
    };
  } catch {
    return {
      available: false,
      provider: "ollama",
      url: OLLAMA_URL,
      model: OLLAMA_MODEL,
      modelInstalled: false,
      message: "Ollama não foi encontrado em execução."
    };
  }
}

export async function generateLocalText(system, user, maxTokens = 900) {
  const response = await ollamaFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      options: { num_predict: maxTokens, temperature: 0.35 }
    })
  }, 90000);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Falha no modelo local.");
  }
  const data = await response.json();
  const text = data?.message?.content?.trim();
  if (!text) throw new Error("O modelo local não retornou texto.");
  return text;
}

export async function ensureLocalModel() {
  const status = await localAIStatus();
  if (!status.available || status.modelInstalled) return status;
  return status;
}

export { OLLAMA_MODEL, OLLAMA_URL };
