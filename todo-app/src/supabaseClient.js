import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

if (!supabaseConfigured) {
  // createClient() throws synchronously on a missing/invalid URL, which would crash
  // the whole app to a blank screen before React even mounts. Fall back to a dummy
  // client so the app can boot and show ConfigError (see main.jsx) instead.
  console.error(
    "Missing Supabase config. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — see README.md."
  );
}

export const supabase = createClient(url || "https://placeholder.invalid", key || "placeholder-anon-key");
