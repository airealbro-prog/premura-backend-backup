import { createClient } from "@supabase/supabase-js";

const frontendSupabaseUrl = import.meta.env.VITE_FRONTEND_SUPABASE_URL as string;
const frontendSupabaseAnonKey = import.meta.env.VITE_FRONTEND_SUPABASE_ANON_KEY as string;

if (!frontendSupabaseUrl || !frontendSupabaseAnonKey) {
  console.warn(
    "[Supabase Frontend] Environment variables missing! Set VITE_FRONTEND_SUPABASE_URL and VITE_FRONTEND_SUPABASE_ANON_KEY."
  );
} else {
  console.log("[Supabase Frontend] Client initialized for project:", frontendSupabaseUrl.replace(/https?:\/\//, "").split(".")[0]);
}

export const supabaseFrontend = createClient(frontendSupabaseUrl ?? "", frontendSupabaseAnonKey ?? "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
