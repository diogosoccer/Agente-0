import { verifyResult, VerificationResult } from "./verificationEngine";

export type RecoveryErrorClass = "temporary" | "permission" | "not_found" | "timeout" | "process_exit" | "invalid_input" | "unknown";

export function classifyRecoveryError(error: unknown): RecoveryErrorClass {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission|permiss|aprova|bloquead|forbidden|unauthorized/i.test(message)) return "permission";
  if (/not found|não encontrado|nao encontrado|arquivo inexistente|does not exist|ENOENT/i.test(message)) return "not_found";
  if (/timeout|tempo limite|timed out|excedeu o tempo/i.test(message)) return "timeout";
  if (/process.*exit|exit code|c[oó]digo.*sa[ií]da|processo.*encerr/i.test(message)) return "process_exit";
  if (/invalid|inv[aá]lid|comando vazio|argumento/i.test(message)) return "invalid_input";
  if (/network|fetch|worker offline|tempor[aá]rio|unavailable|indispon[ií]vel/i.test(message)) return "temporary";
  return "unknown";
}

export type RecoveryAttempt<T> = {
  attempt: number;
  result?: T;
  error?: string;
  verification?: VerificationResult;
};

export async function executeWithRecovery<T>(
  action: (attempt: number) => Promise<T>,
  expected: string,
  options: {
    maxAttempts?: number;
    onRetry?: (attempt: number, error?: unknown) => Promise<void> | void;
    verify?: (result: T) => VerificationResult;
  } = {},
): Promise<{ result: T; attempts: RecoveryAttempt<T>[] }> {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 5));
  const attempts: RecoveryAttempt<T>[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await action(attempt);
      const verification = options.verify ? options.verify(result) : verifyResult(expected, result);
      attempts.push({ attempt, result, verification });
      if (verification.ok) return { result, attempts };
      if (attempt < maxAttempts) await options.onRetry?.(attempt, verification.message);
    } catch (error) {
      const errorClass = classifyRecoveryError(error);
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ attempt, error: message });
      const retryable = errorClass === "temporary" || errorClass === "timeout" || errorClass === "process_exit" || errorClass === "unknown";
      if (attempt < maxAttempts && retryable) await options.onRetry?.(attempt, error);
      if (!retryable) break;
    }
  }

  const last = attempts[attempts.length - 1];
  throw new Error("JARVIS nao conseguiu validar a execucao apos " + maxAttempts + " tentativa(s). " + (last?.error || last?.verification?.message || ""));
}
