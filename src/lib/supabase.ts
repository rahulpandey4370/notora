import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type NotoraClient = SupabaseClient<any, 'notora', any>;

let client: NotoraClient | undefined;

/**
 * Scoped to the "notora" Postgres schema (not the default "public"), which is
 * where ai-expense-tracker's tables live in this same shared Supabase project.
 * Scoping here means every query from this client can only ever see Notora's
 * own tables.
 */
export function getSupabase(): NotoraClient {
  if (!client) {
    const url = process.env.SUPABASE_PROJECT_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables (SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY) are not configured.');
    }
    client = createClient(url, key, { auth: { persistSession: false }, db: { schema: 'notora' } });
  }
  return client;
}
