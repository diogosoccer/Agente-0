import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const required = [
  "src/core/jarvisCore.ts",
  "src/core/verificationEngine.ts",
  "src/services/jarvisMissionEngine.ts",
  "src/services/jarvisRecovery.ts",
  "src/services/agentRuntime.ts",
  "src/services/jarvisMemory.ts",
  "src/services/jarvisCapabilities.ts",
  "worker/server.mjs",
  "desktop/main.cjs",
  "desktop/package.json"
];

for (const file of required) {
  if (!existsSync(file)) throw new Error("Arquivo obrigatório ausente: " + file);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (!packageJson.scripts?.build) throw new Error("Script build ausente.");
if (!packageJson.scripts?.desktop?.includes("desktop")) throw new Error("Script desktop ausente.");

const mission = await readFile("src/services/jarvisMissionEngine.ts", "utf8");
for (const token of ["chooseRecovery", "verification:input", "specialistSummary", "dependenciesSatisfied"]) {
  if (!mission.includes(token)) throw new Error("Contrato de missão ausente: " + token);
}

const worker = await readFile("worker/server.mjs", "utf8");
for (const token of ["/health", "/browser/action", "/screen/capture", "/vision/analyze", "/command/execute"]) {
  if (!worker.includes(token)) throw new Error("Endpoint do Worker ausente: " + token);
}

const desktop = await readFile("desktop/package.json", "utf8");
const desktopJson = JSON.parse(desktop);
if (!desktopJson.build?.win?.target) throw new Error("Target Windows do instalador ausente.");

console.log("Agente Zero contract checks: OK");
