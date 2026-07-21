import { supabase } from "../supabaseClient";

// Same shape as Claude's built-in window.storage: get() returns { key, value } | null,
// set() writes and returns { key, value }. Swapping the backend means the dashboard's
// own logic (JSON.parse(res.value), etc.) doesn't need to change.
export const storage = {
  async get(key) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    // AppShell only mounts once a session is resolved, so a missing user here means
    // something's actually wrong (expired session, auth request failed) — not "no data
    // yet" — and must not be swallowed the same way "no row" is below.
    if (!user) throw new Error("not authenticated");

    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();

    // A real request failure (offline, RLS/network error) must be distinguishable from
    // "no row yet" — the caller falls back to a local cache only for the former.
    if (error) throw error;
    if (!data) return null;
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    // Must throw, not silently no-op — a caller treating this as "saved" when nothing
    // was actually written is exactly the silent-data-loss failure mode this exists to avoid.
    if (!user) throw new Error("not authenticated");

    const parsed = JSON.parse(value);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("kv_store")
      .upsert(
        { user_id: user.id, key, value: parsed, updated_at: updatedAt },
        { onConflict: "user_id,key" }
      );

    if (error) throw error;
    return { key, value, updatedAt };
  },
};
