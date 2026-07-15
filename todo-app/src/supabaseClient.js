import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Shows a clear message instead of a cryptic crash if the .env file is missing
  console.error(
    "Missing Supabase config. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — see README.md."
  );
}

export const supabase = createClient(url || "", key || "");
