import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// Service role key bypasses RLS — server-side only, never expose to the client.
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
