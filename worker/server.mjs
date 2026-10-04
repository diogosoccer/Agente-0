import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { randomUUID } from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4173").split(","));
let busy = false;
const approvalTokens = new Map();
const consumeApproval = (token, task) => { const saved = approvalTokens.get(token); if (!saved) return false; const same = saved.id === task.id && saved.type === task.type && saved.url === task.url; if (same) approvalTokens.delete(token); return same; };

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const AI_INTENTS = [
  "unknown_discovery","dashboard","opportunities","crm","finance","memory",
  "approvals","execution","vision","agents","tasks","settings","status","help","agent"
];

app.post("/intent", async (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  if (!input) return res.status(400).json({ error: "input obrigatório" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY não configurada." });

  const model = process.env.OPENAI_INTENT_MODEL || "gpt-6-luna";
  const system = `Você é o Intent Engine do JARVIS. Sua única função é identificar a intenção do usuário.
Retorne SOMENTE JSON válido com: {"intent":"...","confidence":0.0,"reason":"..."}.
Intenções permitidas: ${AI_INTENTS.join(", ")}.
Escolha a intenção mais adequada ao significado, mesmo que o usuário use palavras diferentes.
Não execute ações, não invente intenções e não peça confirmação.
unknown_discovery = pedidos para surpreender, encontrar algo que o usuário não pediu ou descobrir oportunidades/inconsistências.
help = perguntar o que JARVIS sabe fazer ou como falar com ele.
agent = pedido complexo que deve ser delegado ao sistema multiagente.`;

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: input }
        ],
        max_output_tokens: 200
      })
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) return res.status(502).json({ error: data?.error?.message || "Falha no Intent Engine." });
    const raw = typeof data.output_text === "string" ? data.output_text.trim() : "";
    const parsed = JSON.parse(raw.replace(/^\`\`\`json\s*|\s*\`\`\`$/g, ""));
    if (!AI_INTENTS.includes(parsed.intent)) return res.status(502).json({ error: "Intenção inválida retornada pelo modelo." });
    res.json({
      intent: parsed.intent,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Falha no Intent Engine." });
  }
});

app.post("/plan", async (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  if (!input) return res.status(400).json({ error: "input obrigatório" });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY não configurada." });

  const model = process.env.OPENAI_PLAN_MODEL || process.env.OPENAI_INTENT_MODEL || "gpt-6-luna";
  const system = `Você é o Action Planner do JARVIS, um orquestrador de computador.
Transforme o pedido em um plano executável, mas NÃO execute nada.
Retorne SOMENTE JSON válido:
{"plan":{"id":"string","summary":"string","intent":"string","confidence":0.0,"reason":"string","requiresApproval":false,"actions":[...]}}
Ações permitidas:
- {"type":"navigate","path":"/rota","label":"..."} para rotas internas do Agente Zero.
- {"type":"worker_health","label":"..."} para verificar o computador.\n- {"type":"research_web","query":"...","label":"..."} para pesquisa pública somente leitura no mecanismo de pesquisa local.
- {"type":"open_url","url":"https://...","label":"...","requiresApproval":true} para abrir URL externa.
- {"type":"inspect_site","url":"https://...","label":"...","requiresApproval":true} para inspeção somente leitura.
- {"type":"delegate","goal":"...","label":"..."} para tarefas complexas encaminhadas ao Multi-Agent Runtime.
Rotas internas válidas: /, /oportunidades, /clientes, /servicos, /projetos, /financeiro, /aprovacoes, /memoria, /execucao, /visao, /equipe, /runtime, /agente, /tarefas, /automacao, /expansao, /auditoria, /configuracoes.
Se o pedido envolver ação externa, gasto, publicação, envio, contato ou mudança irreversível, marque requiresApproval=true e use apenas uma ação compatível e segura.
Nunca invente URLs. Se não houver informação suficiente, use delegate com o pedido original.
Não inclua markdown, comentários ou texto fora do JSON.`;

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: input }
        ],
        max_output_tokens: 700
      })
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) return res.status(502).json({ error: data?.error?.message || "Falha no Action Planner." });
    const raw = typeof data.output_text === "string" ? data.output_text.trim() : "";
    const parsed = JSON.parse(raw.replace(/^\`\`\`json\s*|\s*\`\`\`$/g, ""));
    const plan = parsed?.plan;
    const allowed = new Set(["navigate","worker_health","research_web","open_url","inspect_site","delegate"]);
    if (!plan || !Array.isArray(plan.actions) || plan.actions.length > 8) {
      return res.status(502).json({ error: "Plano inválido." });
    }
    for (const action of plan.actions) {
      if (!allowed.has(action?.type)) return res.status(502).json({ error: "Ação não permitida no plano." });
      if (action.type === "navigate" && !String(action.path || "").startsWith("/")) {
        return res.status(502).json({ error: "Rota inválida." });
      }
      if ((action.type === "open_url" || action.type === "inspect_site")) {
        const url = new URL(String(action.url || ""));
        if (!["http:","https:"].includes(url.protocol)) throw new Error("URL inválida.");
        action.requiresApproval = true;
      }
    }
    plan.id = typeof plan.id === "string" ? plan.id : randomUUID();
    plan.confidence = Math.max(0, Math.min(1, Number(plan.confidence) || 0));
    plan.requiresApproval = Boolean(plan.requiresApproval) || plan.actions.some(a => a.type === "open_url" || a.type === "inspect_site");
    res.json({ plan });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Falha no Action Planner." });
  }
});

app.post("/research", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "query obrigatória" });
  if (query.length > 300) return res.status(400).json({ error: "query muito longa" });
  try {
    busy = true;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const encoded = encodeURIComponent(query);
    const target = `https://www.bing.com/search?q=${encoded}`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
    const results = await page.locator("li.b_algo").evaluateAll(nodes => nodes.slice(0, 8).map(node => ({
      title: node.querySelector("h2")?.textContent?.trim() || "",
      url: node.querySelector("h2 a")?.href || "",
      snippet: node.querySelector(".b_caption p")?.textContent?.trim() || ""
    })).filter(x => x.title && x.url));
    await browser.close();
    res.json({ ok: true, query, results });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Falha na pesquisa." });
  } finally {
    busy = false;
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: busy ? "busy" : "connected", version: "0.1.0" });
});

app.post("/approve", (req, res) => {
  const task = req.body;
  if (!task?.id || !task?.type || !task?.url) return res.status(400).json({ error: "id, type e url são obrigatórios." });
  if (!["open_url", "inspect_site", "capture_page"].includes(task.type)) return res.status(400).json({ error: "Tipo de tarefa não permitido." });
  try { const url = new URL(task.url); if (!["http:","https:"].includes(url.protocol)) throw new Error("URL inválida."); } catch { return res.status(400).json({ error: "URL inválida." }); }
  const token = randomUUID(); approvalTokens.set(token, { id: task.id, type: task.type, url: task.url, createdAt: Date.now() });
  setTimeout(() => approvalTokens.delete(token), 5 * 60 * 1000);
  res.json({ ok: true, approvalToken: token });
});

app.post("/tasks", async (req, res) => {
  const task = req.body;
  if (!task?.approvalToken || !consumeApproval(task.approvalToken, task)) return res.status(403).json({ error: "Token de aprovação inválido ou expirado." });
  if (!["open_url", "inspect_site", "capture_page"].includes(task.type)) {
    return res.status(400).json({ error: "Tipo de tarefa não permitido." });
  }
  try {
    const url = new URL(task.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL inválida.");
    busy = true;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20000 });
    const result = {
      taskId: task.id,
      url: page.url(),
      title: await page.title(),
      text: task.type === "inspect_site" ? (await page.locator("body").innerText()).slice(0, 5000) : undefined
    };
    if (task.type === "capture_page") {
      await mkdir("artifacts", { recursive: true });
      const file = "artifacts/page-" + task.id + ".png";
      await page.screenshot({ path: file, fullPage: true });
      result.screenshot = file;
    }
    await browser.close();
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Falha na execução." });
  } finally {
    busy = false;
  }
});


app.post("/open", (req, res) => {
  const task = req.body;
  if (!task?.approvalToken || !consumeApproval(task.approvalToken, { id: task.id, type: "open_url", url: task.url })) {
    return res.status(403).json({ error: "Token de aprovação inválido ou expirado." });
  }
  try {
    const target = new URL(req.body.url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Somente URLs http(s) são permitidas.");
    const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", target.toString()] : [target.toString()];
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    res.json({ ok: true, url: target.toString() });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "URL inválida." });
  }
});

app.listen(port, "127.0.0.1", () => console.log("Agente Zero Browser Worker em http://127.0.0.1:" + port));
