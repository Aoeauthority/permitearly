import { createClient } from "@supabase/supabase-js";

// Server-side client (service role) — never expose to the browser
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
