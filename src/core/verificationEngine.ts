export type VerificationResult = {
  ok: boolean;
  confidence: number;
  message: string;
  checks: string[];
  evidence?: string[];
};

type StructuredResult = {
  success?: boolean;
  verified?: boolean;
  status?: string;
  evidence?: unknown[];
};

export function verifyResult(expected: string, actual: unknown): VerificationResult {
  const checks: string[] = [];
  const evidence: string[] = [];
  const text = typeof actual === "string" ? actual : JSON.stringify(actual ?? "");
  const normalizedText = String(text).toLowerCase().trim();
  const structured = actual && typeof actual === "object" ? actual as StructuredResult : undefined;
  const hasOutput = normalizedText.length > 0;
  checks.push(hasOutput ? "saida presente" : "saida ausente");

  if (structured?.success === false || structured?.verified === false || structured?.status === "error" || structured?.status === "failed") {
    checks.push("resultado explicitamente marcado como falha");
    return { ok: false, confidence: 0.05, message: "A execucao informou falha.", checks, evidence };
  }

  if (Array.isArray(structured?.evidence)) {
    structured.evidence.slice(0, 8).forEach(item => evidence.push(String(item)));
  }

  const words = expected.toLowerCase().trim().split(/\s+/)
    .map(word => word.replace(/[^a-z0-9_-]/g, ""))
    .filter(word => word.length >= 5)
    .slice(0, 8);
  const matched = words.filter(word => normalizedText.includes(word));
  const semanticMatch = words.length === 0 ? hasOutput : matched.length >= Math.max(1, Math.ceil(words.length / 3));
  checks.push(semanticMatch ? "objetivo refletido no resultado" : "evidencia textual insuficiente");

  const explicitSuccess = structured?.success === true || structured?.verified === true || structured?.status === "done" || structured?.status === "completed";
  const ok = hasOutput && (explicitSuccess || semanticMatch);
  const confidence = explicitSuccess && semanticMatch ? 0.98 : explicitSuccess ? 0.9 : semanticMatch ? 0.8 : 0.2;
  return { ok, confidence, message: ok ? "Resultado validado com evidencias suficientes." : "Resultado ainda nao possui evidencias suficientes para validacao.", checks, evidence };
}
