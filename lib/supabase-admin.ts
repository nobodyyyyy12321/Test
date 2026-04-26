import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient<any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient<any>(
      process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}
