import { supabase } from "../supabaseClient";

// Same shape as Claude's built-in window.storage: get() returns { key, value } | null,
// set() writes and returns { key, value }. Swapping the backend means the dashboard's
// own logic (JSON.parse(res.value), etc.) doesn't need to change.
export const storage = {
  async get(key) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return null;

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
