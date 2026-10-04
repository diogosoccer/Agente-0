import express from "express";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

app.post("/music/search", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "query obrigatória" });
  if (query.length > 200) return res.status(400).json({ error: "query muito longa" });
  try {
    busy = true;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const target = `https://www.bing.com/search?q=${encodeURIComponent("site:youtube.com/watch " + query)}`;
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
    const results = await page.locator("li.b_algo").evaluateAll(nodes => nodes.slice(0, 10).map(node => ({
      title: node.querySelector("h2")?.textContent?.trim() || "",
      url: node.querySelector("h2 a")?.href || ""
    })).filter(x => x.title && x.url));
    await browser.close();
    const hit = results.find(x => /youtube\.com\/watch\?v=/.test(x.url));
    if (!hit) return res.status(404).json({ error: "Nenhum vídeo do YouTube encontrado." });
    const parsed = new URL(hit.url);
    const videoId = parsed.searchParams.get("v");
    if (!videoId) return res.status(404).json({ error: "Vídeo inválido." });
    res.json({ ok: true, title: hit.title, videoId });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Falha ao localizar música." });
  } finally {
    busy = false;
  }
});

app.post("/opportunities", async (req, res) => {
  const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
  const categories = Array.isArray(req.body?.categories) ? req.body.categories.filter(x => typeof x === "string").slice(0, 8) : ["comércio","clínica","restaurante","salão","oficina"];
  if (!location) return res.status(400).json({ error: "location obrigatória" });
  if (location.length > 120) return res.status(400).json({ error: "location muito longa" });
  try {
    busy = true;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const candidates = [];
    for (const category of categories) {
      const query = `${category} ${location}`;
      const target = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
      const results = await page.locator("li.b_algo").evaluateAll(nodes => nodes.slice(0, 8).map(node => ({
        name: node.querySelector("h2")?.textContent?.trim() || "",
        url: node.querySelector("h2 a")?.href || "",
        snippet: node.querySelector(".b_caption p")?.textContent?.trim() || ""
      })).filter(x => x.name && x.url));
      for (const result of results) {
        const u = new URL(result.url);
        const isDirectory = /facebook\.com|instagram\.com|tripadvisor|yelp|google\.com|linkedin\.com|telelistas|guiamais|solutudo/i.test(u.hostname);
        const likelyOwnSite = !isDirectory && /https?:\/\//.test(result.url);
        candidates.push({
          id: randomUUID(),
          name: result.name.replace(/\s+[-|].*$/, "").trim(),
          category,
          location,
          sourceUrl: result.url,
          snippet: result.snippet,
          hasOwnSiteEvidence: likelyOwnSite,
          opportunityScore: likelyOwnSite ? 38 : 78,
          reason: likelyOwnSite ? "Há um domínio próprio aparente; vale auditar a qualidade antes de abordar." : "A pesquisa encontrou presença em diretórios/redes, mas não encontrou um domínio próprio entre os primeiros resultados."
        });
      }
    }
    await browser.close();
    const unique = [...new Map(candidates.map(x => [x.name.toLowerCase(), x])).values()]
      .sort((a,b) => b.opportunityScore - a.opportunityScore).slice(0, 30);
    res.json({ ok: true, location, candidates: unique, methodology: "Pesquisa pública em mecanismo de busca; ausência de domínio próprio é um sinal heurístico e precisa de validação antes de contato." });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Falha no radar de oportunidades." });
  } finally {
    busy = false;
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

app.post("/system/action", async (req, res) => {
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  const allowed = new Set(["calculator","files","browser","settings"]);
  if (!allowed.has(action)) return res.status(400).json({ error: "Ação de sistema não permitida." });
  try {
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";
    const commands = {
      calculator: isWin ? ["calc.exe", []] : isMac ? ["open", ["-a","Calculator"]] : ["sh", ["-lc","command -v gnome-calculator >/dev/null && gnome-calculator || command -v kcalc >/dev/null && kcalc || xdg-open 'https://www.google.com/search?q=calculator'"]],
      files: isWin ? ["explorer.exe", ["."]] : isMac ? ["open", ["."]] : ["xdg-open", ["."]],
      browser: isWin ? ["cmd.exe", ["/c","start","","https://www.google.com"]] : isMac ? ["open", ["https://www.google.com"]] : ["xdg-open", ["https://www.google.com"]],
      settings: isWin ? ["cmd.exe", ["/c","start","","ms-settings:"]] : isMac ? ["open", ["x-apple.systempreferences:"]] : ["sh", ["-lc","command -v gnome-control-center >/dev/null && gnome-control-center || command -v systemsettings5 >/dev/null && systemsettings5 || xdg-open 'https://www.google.com/search?q=system+settings'"]]
    };
    const [command,args] = commands[action];
    const child = spawn(command,args,{detached:true,stdio:"ignore",windowsHide:true}); child.unref();
    res.json({ok:true,action,platform:process.platform});
  } catch(error) { res.status(500).json({ok:false,error:error instanceof Error?error.message:"Falha ao abrir aplicativo."}); }
});

const ebookTopics = [
  "produtividade para estudantes","organização pessoal","inteligência artificial para iniciantes",
  "hábitos de estudo","criatividade e resolução de problemas","educação financeira básica",
  "pensamento crítico e tomada de decisão","como aprender mais rápido com métodos simples"
];
const ebookStateFile = "artifacts/ebooks/.factory-state.json";
let ebookState = { lastRun:null, nextRun:null, lastFile:null, lastTopic:null, lastQuality:null, history:[] };
async function loadEbookState(){ try{ ebookState=JSON.parse(await readFile(ebookStateFile,"utf8")); }catch{} }
async function saveEbookState(){ await mkdir("artifacts/ebooks",{recursive:true}); await writeFile(ebookStateFile,JSON.stringify(ebookState,null,2),"utf8"); }
function ebookSlug(value){ return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70); }
function qualityScore(sources,chapters){ return Math.min(100,Math.min(40,sources.length*7)+Math.min(35,chapters.length*4)+25); }
async function researchEbookTopic(topic){
  const browser=await chromium.launch({headless:true}); const page=await browser.newPage();
  await page.goto("https://www.bing.com/search?q="+encodeURIComponent(topic+" guia fundamentos estudos pesquisas"),{waitUntil:"domcontentloaded",timeout:20000});
  const sources=await page.locator("li.b_algo").evaluateAll(nodes=>nodes.slice(0,8).map(node=>({
    title:node.querySelector("h2")?.textContent?.trim()||"",url:node.querySelector("h2 a")?.href||"",
    snippet:node.querySelector(".b_caption p")?.textContent?.trim()||""
  })).filter(x=>x.title&&x.url)); await browser.close(); return sources;
}
async function generateEbook(topic){
  busy=true;
  try{
    const sources=await researchEbookTopic(topic), date=new Date().toISOString().slice(0,10);
    const title="Guia prático: "+topic.charAt(0).toUpperCase()+topic.slice(1);
    const chapters=[
      ["Introdução","Este material transforma conceitos fundamentais de "+topic+" em um roteiro curto, aplicável e revisável."],
      ["O que realmente importa",sources[0]?.snippet||"Comece pelos fundamentos, defina um objetivo observável e reduza a quantidade de ações simultâneas."],
      ["Passo 1 — Defina seu ponto de partida","Registre o que você já sabe, o resultado desejado e a principal dificuldade que está impedindo o avanço."],
      ["Passo 2 — Monte um sistema simples","Escolha uma rotina pequena, repetível e fácil de medir. Um sistema sustentável vale mais que uma explosão de motivação."],
      ["Passo 3 — Transforme conhecimento em prática","Converta cada conceito em uma ação, exercício, pergunta ou teste. Registre o que funcionou e o que precisa ser ajustado."],
      ["Erros comuns","Evite excesso de ferramentas, metas vagas, copiar métodos sem contexto, depender apenas de motivação e não revisar resultados."],
      ["Plano de 7 dias","Dia 1: objetivo. Dia 2: diagnóstico. Dia 3: primeira prática. Dia 4: revisão. Dia 5: repetição. Dia 6: melhoria. Dia 7: avaliação e próximo ciclo."],
      ["Checklist final","Objetivo definido; rotina escolhida; primeira ação executada; resultado registrado; principal erro identificado; próximo passo definido."],
      ["Conclusão","O valor do guia aparece quando uma ideia é aplicada, medida e melhorada. Use este material como ponto de partida, não como promessa de resultado."]
    ];
    const score=qualityScore(sources,chapters);
    const body=chapters.map(([h,p])=>"## "+h+"\n\n"+p).join("\n\n");
    const sourceBlock="\n\n## Fontes para aprofundamento\n\n"+sources.map(s=>"- ["+s.title.replace(/\[/g,"(").replace(/\]/g,")")+"]("+s.url+") — "+s.snippet).join("\n");
    const meta="\n\n---\n**Metadados de produção**\n- Tema: "+topic+"\n- Fontes pesquisadas: "+sources.length+"\n- Score editorial automático: "+score+"/100\n- Estado: RASCUNHO — revisão humana necessária\n";
    const md="# "+title+"\n\n"+body+sourceBlock+meta;
    await mkdir("artifacts/ebooks",{recursive:true});
    const slug=ebookSlug(topic);
    const file="artifacts/ebooks/"+date+"-"+slug+".md"; await writeFile(file,md,"utf8");
    const product={
      schemaVersion:"1.0",status:"draft",title,slug,topic,createdAt:new Date().toISOString(),
      shortDescription:"Guia prático e objetivo sobre "+topic+".",
      longDescription:"Material educativo estruturado em etapas, checklist e plano de 7 dias. Revisão humana recomendada antes de qualquer publicação.",
      qualityScore:score,sources:sources.map(s=>({title:s.title,url:s.url})),
      publishing:{externalPlatform:null,requiresHumanApproval:true}
    };
    await writeFile("artifacts/ebooks/"+date+"-"+slug+".product.json",JSON.stringify(product,null,2),"utf8");
    const safeTitle=title.replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const salesPage="<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>"+safeTitle+"</title><style>body{font-family:system-ui;max-width:760px;margin:0 auto;padding:48px 20px;line-height:1.6}main{border:1px solid #ddd;border-radius:20px;padding:32px}h1{font-size:42px;line-height:1.1}a,button{display:inline-block;padding:12px 18px;border-radius:10px;border:1px solid #222;text-decoration:none}small{color:#666}</style></head><body><main><small>GUIA PRÁTICO</small><h1>"+safeTitle+"</h1><p>Um material direto para transformar conhecimento em prática.</p><h2>Você vai encontrar</h2><ul><li>fundamentos organizados</li><li>passos práticos</li><li>plano de 7 dias</li><li>checklist final</li></ul><p><b>Importante:</b> este arquivo é um rascunho editorial e precisa de revisão humana antes de ser vendido ou publicado.</p></main></body></html>";
    await writeFile("artifacts/ebooks/"+date+"-"+slug+".sales.html",salesPage,"utf8");
    const now=new Date(), next=new Date(now.getTime()+86400000);
    ebookState={lastRun:now.toISOString(),nextRun:next.toISOString(),lastFile:file,lastTopic:topic,lastQuality:score,
      history:[{date:now.toISOString(),topic,file,quality:score,sources:sources.length},...(ebookState.history||[])].slice(0,30)};
    await saveEbookState(); return {ok:true,title,topic,file,sources:sources.length,quality:score,state:ebookState};
  }finally{busy=false;}
}
app.post("/ebook/generate", async (req, res) => {
  const topic = typeof req.body?.topic === "string" && req.body.topic.trim() ? req.body.topic.trim().slice(0, 120) : ebookTopics[new Date().getDate() % ebookTopics.length];
  if (busy) return res.status(409).json({ ok: false, error: "Worker ocupado." });
  try { res.json(await generateEbook(topic)); }
  catch (error) { res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Falha ao gerar e-book." }); }
});

app.get("/ebook/status", async (_req,res)=>{ await loadEbookState(); res.json({ok:true,...ebookState,topics:ebookTopics,workerOnline:true}); });
loadEbookState().catch(()=>{});
setInterval(async () => {
  if (busy) return;
  const topic = ebookTopics[new Date().getDate() % ebookTopics.length];
  try { await generateEbook(topic); }
  catch (error) { console.error("Daily ebook factory:", error instanceof Error ? error.message : error); }
}, 24 * 60 * 60 * 1000);

app.post("/opportunities/deep", async (req, res) => {
  const candidate = req.body?.candidate && typeof req.body.candidate === "object" ? req.body.candidate : null;
  if (!candidate?.name || !candidate?.location) return res.status(400).json({ ok:false, error:"candidate com name e location é obrigatório." });
  const query = String(candidate.name) + " " + String(candidate.location);
  try {
    busy = true;
    const browser = await chromium.launch({ headless:true });
    const page = await browser.newPage();
    await page.goto("https://www.bing.com/search?q=" + encodeURIComponent(query), { waitUntil:"domcontentloaded", timeout:20000 });
    const results = await page.locator("li.b_algo").evaluateAll(nodes => nodes.slice(0,10).map(node => ({
      title: node.querySelector("h2")?.textContent?.trim() || "",
      url: node.querySelector("h2 a")?.href || "",
      snippet: node.querySelector(".b_caption p")?.textContent?.trim() || ""
    })).filter(x => x.title && x.url));
    await browser.close();
    const domains = results.map(x => { try { return new URL(x.url).hostname.replace(/^www\./,""); } catch { return ""; } }).filter(Boolean);
    const ownSite = domains.find(d => !/facebook|instagram|google|tripadvisor|yelp|linkedin|telelistas|guiamais|solutudo/i.test(d)) || null;
    const social = results.filter(x => /facebook|instagram|linkedin/i.test(x.url)).map(x=>x.url).slice(0,4);
    const evidence = results.slice(0,6).map(x => ({ title:x.title, url:x.url, snippet:x.snippet }));
    const qualitySignals = { ownSiteFound:Boolean(ownSite), socialPresence:social.length>0, searchEvidence:evidence.length, directoryHeavy:evidence.filter(x=>/tripadvisor|yelp|telelistas|guiamais|solutudo/i.test(x.url)).length };
    const score = Math.max(0, Math.min(100, (qualitySignals.ownSiteFound ? 25 : 72) + (qualitySignals.socialPresence ? 8 : 0) + Math.min(10, qualitySignals.directoryHeavy*2)));
    res.json({ ok:true, candidate, query, score, ownSite, social, evidence, qualitySignals,
      recommendation: qualitySignals.ownSiteFound ? "Auditar o site existente antes de propor qualquer melhoria." : "Há sinal de oportunidade digital, mas a ausência de domínio próprio precisa ser confirmada manualmente antes de contato." });
  } catch(error) { res.status(502).json({ok:false,error:error instanceof Error?error.message:"Falha na auditoria."}); }
  finally { busy=false; }
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
