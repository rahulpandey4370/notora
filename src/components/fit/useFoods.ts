import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Food } from '@/lib/food-match';
import type { AppData } from '@/lib/types';
import { deleteFood, listFoods, saveFood } from '@/lib/foods';
import { loadCatalog, type CatalogFood } from '@/lib/food-catalog';

const DEMO: Food[] = [
  { id: 'demo-rice', name: 'Steamed white rice', aliases: ['rice', 'chawal'], unit: 'g', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, servings: [{ label: 'katori', amount: 150 }] },
  { id: 'demo-roti', name: 'Whole wheat roti', aliases: ['roti', 'chapati', 'phulka'], unit: 'g', kcal: 297, proteinG: 9.6, carbsG: 54, fatG: 3.7, fiberG: 9, servings: [{ label: 'roti', amount: 40 }] },
  { id: 'demo-whey', name: 'Whey protein', aliases: ['whey', 'protein shake'], unit: 'g', kcal: 393, proteinG: 78, carbsG: 9, fatG: 6, fiberG: 0, servings: [{ label: 'scoop', amount: 33 }] },
  { id: 'demo-banana', name: 'Banana', aliases: [], unit: 'g', kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, fiberG: 2.6, servings: [{ label: 'banana', amount: 118 }] },
  { id: 'demo-bar', name: 'Yoga Bar protein bar', aliases: ['protein bar'], unit: 'serving', kcal: 210, proteinG: 20, carbsG: 22, fatG: 7, fiberG: 5, servings: [] },
];

export type FoodsApi = {
  status: 'loading' | 'ready' | 'missing' | 'error'; foods: Food[]; error?: string;
  /** The built-in catalogue (All foods) minus the ones you removed; empty until its file has loaded. Read-only. */
  catalog: CatalogFood[];
  /** Built-in foods you removed, with hide/restore. No-ops without onDataChange. */
  hidden: CatalogFood[];
  hide: (id: string) => void;
  unhide: (id: string) => void;
  save: (f: Omit<Food, 'id'> & { id?: string }) => Promise<{ ok: boolean; error?: string; food?: Food }>;
  remove: (id: string) => Promise<void>;
};

/** My Foods for the Logs page: Supabase for a signed-in user, a fixed in-memory list in the showcase. */
export function useFoods(showcase: boolean, data?: AppData, onDataChange?: (d: AppData) => void): FoodsApi {
  const [state, setState] = useState<Pick<FoodsApi, 'status' | 'foods' | 'error'>>({ status: 'loading', foods: [] });
  const [catalog, setCatalog] = useState<CatalogFood[]>([]);
  useEffect(() => { loadCatalog().then(setCatalog).catch(() => undefined); }, []);

  useEffect(() => {
    if (showcase) { setState({ status: 'ready', foods: DEMO }); return; }
    let live = true;
    listFoods()
      .then(r => { if (live) setState(r.ok ? { status: 'ready', foods: r.foods } : 'missing' in r ? { status: 'missing', foods: [] } : { status: 'error', foods: [], error: r.error }); })
      .catch(e => { if (live) setState({ status: 'error', foods: [], error: (e as Error).message }); });
    return () => { live = false; };
  }, [showcase]);

  const upsertLocal = (f: Food) => setState(s => ({ ...s, foods: [...s.foods.filter(x => x.id !== f.id), f].sort((a, b) => a.name.localeCompare(b.name)) }));

  const save = useCallback<FoodsApi['save']>(async f => {
    if (showcase) {
      const food = { ...f, id: f.id ?? uuidv4() } as Food;
      upsertLocal(food);
      return { ok: true, food };
    }
    const r = await saveFood(f).catch(e => ({ ok: false as const, error: (e as Error).message }));
    if (r.ok) { upsertLocal(r.food); return { ok: true, food: r.food }; }
    return { ok: false, error: r.error };
  }, [showcase]);

  const remove = useCallback<FoodsApi['remove']>(async id => {
    setState(s => ({ ...s, foods: s.foods.filter(f => f.id !== id) }));
    if (!showcase) await deleteFood(id).catch(() => undefined);
  }, [showcase]);

  const hiddenIds = data?.hiddenFoods;
  const [shown, hidden] = useMemo(() => {
    const h = new Set(hiddenIds ?? []);
    return [catalog.filter(f => !h.has(f.id)), catalog.filter(f => h.has(f.id))];
  }, [catalog, hiddenIds]);
  const setHidden = (ids: string[]) => { if (data && onDataChange) onDataChange({ ...data, hiddenFoods: ids }); };
  const hide = (id: string) => setHidden([...new Set([...(hiddenIds ?? []), id])]);
  const unhide = (id: string) => setHidden((hiddenIds ?? []).filter(x => x !== id));

  return { ...state, catalog: shown, hidden, hide, unhide, save, remove };
}
