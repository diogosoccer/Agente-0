import { verifyResult, VerificationResult } from "./verificationEngine";

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
      attempts.push({ attempt, error: error instanceof Error ? error.message : String(error) });
      if (attempt < maxAttempts) await options.onRetry?.(attempt, error);
    }
  }

  const last = attempts[attempts.length - 1];
  throw new Error("JARVIS nao conseguiu validar a execucao apos " + maxAttempts + " tentativa(s). " + (last?.error || last?.verification?.message || ""));
}
