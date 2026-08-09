'use server';

import { getSupabase } from '@/lib/supabase';
import type { AppData } from '@/lib/types';

export async function getAppData(username: string): Promise<AppData | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch app data for user ${username} from Supabase:`, error.message);
      return null;
    }
    if (!data) {
      console.log(`No data found for user ${username}, returning null.`);
      return null;
    }
    return data.data as AppData;
  } catch (error: any) {
    console.error(`Failed to fetch app data for user ${username} from Supabase:`, error);
    return null;
  }
}

export async function saveAppData(username: string, data: AppData): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('app_data')
      .upsert({ username: username.toLowerCase(), data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('Failed to save app data to Supabase:', error);
    throw error;
  }
}
