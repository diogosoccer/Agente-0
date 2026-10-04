import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://cdofspqwqgrzarywdwyu.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "sb_publishable_Jg2rm5BiAnCNq8pJu24R2A_eIMLNDls";

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function ensureJarvisSession() {
  if (!supabase) return null;
  const current = await supabase.auth.getSession();
  if (current.data.session) return current.data.session;

  const anonymous = await supabase.auth.signInAnonymously();
  if (anonymous.error) throw anonymous.error;
  return anonymous.data.session;
}
