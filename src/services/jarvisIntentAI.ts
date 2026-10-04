export type AIIntentResult = {
  intent: string;
  confidence: number;
  reason?: string;
};

export async function understandWithAI(input: string, baseUrl = "http://localhost:8787"): Promise<AIIntentResult | null> {
  try {
    const response = await fetch(baseUrl.replace(/\/$/, "") + "/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.intent || typeof data.intent !== "string") return null;
    return {
      intent: data.intent,
      confidence: Number(data.confidence) || 0,
      reason: typeof data.reason === "string" ? data.reason : undefined,
    };
  } catch {
    return null;
  }
}
