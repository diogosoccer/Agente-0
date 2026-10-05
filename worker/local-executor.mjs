import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";

const port = Number(process.env.LOCAL_EXECUTOR_PORT || 8788);
const approvalTokens = new Map();
const MAX_BODY = 2 * 1024 * 1024;
function expandPath(value) { return String(value || "").replace(/%([^%]+)%/g, (_, key) => process.env[key] || `%${key}%`); }

const PERMISSIONS = {
  automatic: new Set(["open_app", "health", "file_search", "file_read"]),
  confirmation: new Set(["close_app", "file_create", "file_move", "file_rename", "run_command"]),
  blocked: new Set(["delete_file", "kill_process", "credential_change", "shutdown", "format_disk"])
};

const blockedCommandPatterns = [
  /format\s+[a-z]:/i,
  /diskpart/i,
  /remove-item\s+.*-recurse.*-force/i,
  /del\s+\/s\s+\/q/i,
  /rd\s+\/s\s+\/q/i,
  /shutdown\s/i,
  /stop-computer/i,
  /set-executionpolicy/i
];

function permissionFor(action) {
  if (PERMISSIONS.blocked.has(action)) return "blocked";
  if (PERMISSIONS.confirmation.has(action)) return "confirmation";
  return "automatic";
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error("Payload muito grande.");
  }
  return raw ? JSON.parse(raw) : {};
}

function tokenFor(task) {
  const token = randomUUID();
  approvalTokens.set(token, { ...task, createdAt: Date.now() });
  setTimeout(() => approvalTokens.delete(token), 5 * 60 * 1000);
  return token;
}

function consume(token, task) {
  const saved = approvalTokens.get(token);
  if (!saved) return false;
  const same = Object.entries(task).every(([key, value]) => saved[key] === value);
  if (!same) return false;
  approvalTokens.delete(token);
  return true;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = "", stderr = "";
    child.stdout?.on("data", d => stdout += d.toString());
    child.stderr?.on("data", d => stderr += d.toString());
    child.on("error", reject);
    child.on("close", code => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function searchFiles(root, query, limit = 50) {
  const results = [];
  const needle = String(query || "").toLowerCase();
  async function walk(dir, depth) {
    if (results.length >= limit || depth > 8) return;
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.name.toLowerCase().includes(needle)) results.push(full);
      if (entry.isDirectory()) await walk(full, depth + 1);
    }
  }
  await walk(path.resolve(root || "."), 0);
  return results;
}

async function handle(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "connected", service: "local-executor", version: "1.0.0", platform: process.platform });
  }

  let data;
  try { data = await body(req); } catch (e) { return json(res, 400, { ok: false, error: e.message }); }

  if (req.method === "POST" && url.pathname === "/permissions/check") {
    const action = String(data.action || "");
    const permission = permissionFor(action);
    return json(res, 200, { ok: true, action, permission });
  }

  if (req.method === "POST" && url.pathname === "/verify") {
    const action = String(data.action || "");
    try {
      if (action === "open_app") {
        const app = String(data.app || "").replace(/\.exe$/i, "") + ".exe";
        const result = await run("tasklist", ["/FI", "IMAGENAME eq " + app]);
        const verified = result.code === 0 && result.stdout.toLowerCase().includes(app.toLowerCase());
        return json(res, 200, { ok: true, status: verified ? "VERIFIED" : "UNCERTAIN", verified, evidence: result.stdout.trim() });
      }
      if (action === "close_app") {
        const app = String(data.app || "").replace(/\.exe$/i, "") + ".exe";
        const result = await run("tasklist", ["/FI", "IMAGENAME eq " + app]);
        const verified = result.code === 0 && !result.stdout.toLowerCase().includes(app.toLowerCase());
        return json(res, 200, { ok: true, status: verified ? "VERIFIED" : "UNCERTAIN", verified, evidence: result.stdout.trim() });
      }
      if (action === "file_create") {
        const filePath = expandPath(data.path);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf8");
        const expected = data.content === undefined ? null : String(data.content);
        const verified = stat.isFile() && (expected === null || content === expected);
        return json(res, 200, { ok: true, status: verified ? "VERIFIED" : "FAILED", verified, evidence: { path: filePath, bytes: stat.size } });
      }
      if (action === "file_move") {
        const source = expandPath(data.source), destination = expandPath(data.destination);
        const sourceExists = await fs.access(source).then(() => true).catch(() => false);
        const destinationExists = await fs.access(destination).then(() => true).catch(() => false);
        const verified = !sourceExists && destinationExists;
        return json(res, 200, { ok: true, status: verified ? "VERIFIED" : "FAILED", verified, evidence: { sourceExists, destinationExists, source, destination } });
      }
      if (action === "file_rename") {
        const source = expandPath(data.source), name = String(data.name || "");
        const destination = path.join(path.dirname(source), name);
        const sourceExists = await fs.access(source).then(() => true).catch(() => false);
        const destinationExists = await fs.access(destination).then(() => true).catch(() => false);
        const verified = !sourceExists && destinationExists;
        return json(res, 200, { ok: true, status: verified ? "VERIFIED" : "FAILED", verified, evidence: { sourceExists, destinationExists, source, destination } });
      }
      if (action === "file_search") {
        const results = await searchFiles(expandPath(data.root || process.env.USERPROFILE || process.cwd()), data.query || "", Math.min(Number(data.limit) || 50, 100));
        return json(res, 200, { ok: true, status: "VERIFIED", verified: true, evidence: { count: results.length, results } });
      }
      if (action === "file_read") {
        const filePath = expandPath(data.path);
        const stat = await fs.stat(filePath);
        return json(res, 200, { ok: true, status: stat.isFile() ? "VERIFIED" : "FAILED", verified: stat.isFile(), evidence: { path: filePath, bytes: stat.size } });
      }
      return json(res, 200, { ok: true, status: "UNCERTAIN", verified: false, evidence: ["Não existe verificador específico para esta ação."] });
    } catch (error) {
      return json(res, 200, { ok: false, status: "FAILED", verified: false, error: error instanceof Error ? error.message : "Falha na verificação." });
    }
  }

  if (req.method === "POST" && url.pathname === "/approve") {
    const action = String(data.action || "");
    const permission = permissionFor(action);
    if (permission === "blocked") return json(res, 403, { ok: false, error: "Ação bloqueada pela política de segurança." });
    if (permission !== "confirmation") return json(res, 200, { ok: true, permission, approvalToken: null });
    if (action === "run_command" && blockedCommandPatterns.some(re => re.test(String(data.command || "")))) {
      return json(res, 403, { ok: false, error: "Comando bloqueado pela política de segurança." });
    }
    const approvalToken = tokenFor({ id: String(data.id || ""), action, path: data.path, source: data.source, command: data.command, app: data.app });
    return json(res, 200, { ok: true, permission, approvalToken });
  }

  if (req.method !== "POST") return json(res, 404, { ok: false, error: "Rota não encontrada." });

  const action = String(data.action || "");
  const permission = permissionFor(action);
  if (permission === "blocked") return json(res, 403, { ok: false, error: "Ação bloqueada pela política de segurança." });

  if (permission === "confirmation") {
    const expected = { id: String(data.id || ""), action, path: data.path, source: data.source, command: data.command, app: data.app };
    if (!consume(String(data.approvalToken || ""), expected)) {
      return json(res, 403, { ok: false, error: "Aprovação inválida ou expirada." });
    }
  }

  try {
    if (action === "open_app") {
      const app = String(data.app || "").trim();
      if (!/^[a-zA-Z0-9._ -]+(?:\.exe)?$/.test(app)) throw new Error("Aplicativo fora da allowlist.");
      const target = app.endsWith(".exe") ? app : app + ".exe";
      spawn(target, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      return json(res, 200, { ok: true, action, app, permission });
    }

    if (action === "close_app") {
      const app = String(data.app || "").trim().replace(/\.exe$/i, "") + ".exe";
      if (!/^[a-zA-Z0-9._ -]+\.exe$/i.test(app)) throw new Error("Aplicativo inválido.");
      const result = await run("taskkill", ["/IM", app, "/T"]);
      if (result.code !== 0) throw new Error(result.stderr || "Não foi possível fechar o aplicativo.");
      return json(res, 200, { ok: true, action, app, permission, stdout: result.stdout.trim() });
    }

    if (action === "file_search") {
      const results = await searchFiles(expandPath(data.root || process.env.USERPROFILE || process.cwd()), data.query || "", Math.min(Number(data.limit) || 50, 100));
      return json(res, 200, { ok: true, action, results, count: results.length });
    }

    if (action === "file_read") {
      const filePath = expandPath(data.path);
      const content = await fs.readFile(filePath, "utf8");
      return json(res, 200, { ok: true, action, path: filePath, content: content.slice(0, 200000) });
    }

    if (action === "file_create") {
      const filePath = String(data.path || "");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, String(data.content || ""), "utf8");
      return json(res, 200, { ok: true, action, path: filePath, bytes: Buffer.byteLength(String(data.content || "")) });
    }

    if (action === "file_move") {
      const source = expandPath(data.source), destination = expandPath(data.destination);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
      return json(res, 200, { ok: true, action, source, destination });
    }

    if (action === "file_rename") {
      const source = expandPath(data.source), name = String(data.name || "");
      if (!name || name.includes("\\") || name.includes("/")) throw new Error("Novo nome inválido.");
      const destination = path.join(path.dirname(source), name);
      await fs.rename(source, destination);
      return json(res, 200, { ok: true, action, source, destination });
    }

    if (action === "run_command") {
      const command = String(data.command || "").trim();
      if (!command) throw new Error("Comando vazio.");
      if (blockedCommandPatterns.some(re => re.test(command))) throw new Error("Comando bloqueado pela política de segurança.");
      const result = process.platform === "win32"
        ? await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command])
        : await run("sh", ["-lc", command]);
      return json(res, result.code === 0 ? 200 : 500, {
        ok: result.code === 0,
        action,
        code: result.code,
        stdout: result.stdout.slice(0, 20000),
        stderr: result.stderr.slice(0, 10000)
      });
    }

    if (action === "health") return json(res, 200, { ok: true, platform: process.platform });
    return json(res, 400, { ok: false, error: "Ação desconhecida." });
  } catch (error) {
    return json(res, 500, { ok: false, action, error: error instanceof Error ? error.message : "Falha no executor local." });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => json(res, 500, { ok: false, error: error.message }));
});
server.listen(port, "127.0.0.1", () => console.log("Agente Zero Local Executor em http://127.0.0.1:" + port));
