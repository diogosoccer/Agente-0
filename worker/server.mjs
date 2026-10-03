import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4173").split(","));
let busy = false;

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

app.get("/health", (_req, res) => {
  res.json({ status: busy ? "busy" : "connected", version: "0.1.0" });
});

app.post("/tasks", async (req, res) => {
  const task = req.body;
  if (!task?.approved) return res.status(403).json({ error: "Tarefa não aprovada." });
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
  if (!req.body?.approved) return res.status(403).json({ error: "Ação não aprovada." });
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
\napp.listen(port, "127.0.0.1", () => console.log("Agente Zero Browser Worker em http://127.0.0.1:" + port));
