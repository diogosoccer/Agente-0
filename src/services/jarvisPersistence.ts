import { supabase, supabaseConfigured, ensureJarvisSession } from "./supabaseClient";

export type PersistedRecordKind =
  | "mission"
  | "task"
  | "memory"
  | "execution"
  | "approval"
  | "event"
  | "opportunity";

type RecordRow = {
  id: string;
  user_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const tableFor = (kind: PersistedRecordKind) => `jarvis_${kind === "memory" ? "memories" : kind === "missions" ? "missions" : kind === "tasks" ? "tasks" : kind === "executions" ? "executions" : kind === "approval" ? "approvals" : kind === "event" ? "events" : "opportunities"}`;

export async function persistenceAvailable() {
  return Boolean(supabaseConfigured && supabase);
}

export async function upsertJarvisRecord(
  kind: PersistedRecordKind,
  id: string,
  data: Record<string, unknown>,
) {
  if (!supabase) return { ok: false, reason: "not_configured" as const };
  try {
    const session = await ensureJarvisSession();
    if (!session?.user) return { ok: false, reason: "no_session" as const };

    const table = tableFor(kind);
    const { error } = await supabase.from(table).upsert(
      {
        id,
        user_id: session.user.id,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return { ok: true as const };
  } catch (error) {
    console.warn("[JARVIS persistence] upsert failed", error);
    return { ok: false, reason: "remote_error" as const, error };
  }
}

export async function deleteJarvisRecord(kind: PersistedRecordKind, id: string) {
  if (!supabase) return false;
  try {
    const session = await ensureJarvisSession();
    if (!session?.user) return false;
    const { error } = await supabase.from(tableFor(kind)).delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("[JARVIS persistence] delete failed", error);
    return false;
  }
}

export async function listJarvisRecords(kind: PersistedRecordKind, limit = 500) {
  if (!supabase) return [] as RecordRow[];
  try {
    const session = await ensureJarvisSession();
    if (!session?.user) return [];
    const { data, error } = await supabase
      .from(tableFor(kind))
      .select("id,user_id,data,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RecordRow[];
  } catch (error) {
    console.warn("[JARVIS persistence] list failed", error);
    return [] as RecordRow[];
  }
}

export async function initializeJarvisPersistence() {
  if (!supabaseConfigured) return { configured: false, authenticated: false };
  try {
    const session = await ensureJarvisSession();
    return { configured: true, authenticated: Boolean(session?.user) };
  } catch (error) {
    console.warn("[JARVIS persistence] session bootstrap unavailable", error);
    return { configured: true, authenticated: false };
  }
}
