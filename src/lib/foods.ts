'use server';

import { getSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/session';
import type { Food } from '@/lib/food-match';

/**
 * My Foods, one row per saved item in notora.foods (supabase/notora-v5-foods-reminders.sql).
 * The user always comes from the session cookie. `missing` = the table isn't
 * there yet (SQL not run): the page hides the library instead of failing.
 */
export type FoodsResult = { ok: true; foods: Food[] } | { ok: false; missing: true } | { ok: false; error: string };

type Row = { id: string; name: string; aliases: string[] | null; unit: Food['unit']; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; servings: Food['servings'] | null };
const toFood = (r: Row): Food => ({
  id: r.id, name: r.name, aliases: r.aliases ?? [], unit: r.unit, kcal: Number(r.kcal), proteinG: Number(r.protein_g), carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g), fiberG: Number(r.fiber_g), servings: Array.isArray(r.servings) ? r.servings : [],
});
const isMissing = (e: { code?: string; message?: string }) => e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? '');
const SETUP = 'My Foods isn’t set up yet: run supabase/notora-v5-foods-reminders.sql in Supabase.';
const COLS = 'id, name, aliases, unit, kcal, protein_g, carbs_g, fat_g, fiber_g, servings';

/** Trust nothing from the client: trimmed text, finite non-negative numbers, per 100 g or ml (never per piece only), at most 10 servings. */
function clean(f: Omit<Food, 'id'>) {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0);
  const name = String(f.name ?? '').trim().slice(0, 80);
  if (!name) throw new Error('A food needs a name.');
  if (f.unit !== 'g' && f.unit !== 'ml') throw new Error('Add what 1 piece weighs (g or ml), so it can be logged by weight too.');
  return {
    name, aliases: (f.aliases ?? []).map(a => String(a).trim().slice(0, 40)).filter(Boolean).slice(0, 10),
    unit: f.unit,
    kcal: n(f.kcal), protein_g: n(f.proteinG), carbs_g: n(f.carbsG), fat_g: n(f.fatG), fiber_g: n(f.fiberG),
    servings: (f.servings ?? []).filter(s => String(s.label ?? '').trim() && n(s.amount) > 0).slice(0, 10).map(s => ({ label: String(s.label).trim().slice(0, 30), amount: n(s.amount) })),
  };
}

export async function listFoods(): Promise<FoodsResult> {
  const username = await requireUser();
  const { data, error } = await getSupabase().from('foods').select(COLS).eq('username', username).order('name');
  if (error) return isMissing(error) ? { ok: false, missing: true } : { ok: false, error: error.message };
  return { ok: true, foods: (data as Row[]).map(toFood) };
}

/** Create, or update when `id` is given (only your own row). A new food with the same name (any case) updates that one. */
export async function saveFood(food: Omit<Food, 'id'> & { id?: string }): Promise<{ ok: true; food: Food } | { ok: false; error: string }> {
  const username = await requireUser();
  let row;
  try { row = clean(food); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = getSupabase();
  let id = food.id;
  if (!id) {
    const pattern = row.name.replace(/[\\%_]/g, c => `\\${c}`);
    const { data: hit, error } = await supabase.from('foods').select('id').eq('username', username).ilike('name', pattern).maybeSingle();
    if (error) return { ok: false, error: isMissing(error) ? SETUP : error.message };
    id = hit?.id;
  }
  const now = new Date().toISOString();
  const { data, error } = id
    ? await supabase.from('foods').update({ ...row, updated_at: now }).eq('id', id).eq('username', username).select(COLS).single()
    : await supabase.from('foods').insert({ ...row, username, updated_at: now }).select(COLS).single();
  if (error) return { ok: false, error: isMissing(error) ? SETUP : error.message };
  return { ok: true, food: toFood(data as Row) };
}

export async function deleteFood(id: string): Promise<{ ok: boolean }> {
  const username = await requireUser();
  const { error } = await getSupabase().from('foods').delete().eq('id', id).eq('username', username);
  return { ok: !error };
}
