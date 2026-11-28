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
  { id: 'demo-bar', name: 'Yoga Bar protein bar', aliases: ['protein bar'], unit: 'g', kcal: 350, proteinG: 33.3, carbsG: 36.7, fatG: 11.7, fiberG: 8.3, servings: [{ label: 'bar', amount: 60 }] },
];

export type FoodsApi = {
  status: 'loading' | 'ready' | 'missing' | 'error'; foods: Food[]; error?: string;
  /** The built-in catalogue (All foods) minus the ones you removed; empty until its file has loaded. Read-only. */
  catalog: CatalogFood[];
  /** Why the catalogue may be empty: still loading, or it failed (then `reloadCatalog` tries again). */
  catalogStatus: 'loading' | 'ready' | 'failed';
  reloadCatalog: () => void;
  /** Built-in foods you removed, with hide/restore. No-ops without onDataChange. */
  hidden: CatalogFood[];
  hide: (id: string) => void;
  unhide: (id: string) => void;
  save: (f: Omit<Food, 'id'> & { id?: string }) => Promise<{ ok: boolean; error?: string; food?: Food }>;
  /** Removes at once; if the server refuses, the food is put back and the result says so. */
  remove: (id: string) => Promise<{ ok: boolean }>;
};

/** My Foods for the Logs page: Supabase for a signed-in user, a fixed in-memory list in the showcase. */
export function useFoods(showcase: boolean, data?: AppData, onDataChange?: (d: AppData) => void): FoodsApi {
  const [state, setState] = useState<Pick<FoodsApi, 'status' | 'foods' | 'error'>>({ status: 'loading', foods: [] });
  const [catalog, setCatalog] = useState<CatalogFood[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<FoodsApi['catalogStatus']>('loading');
  const [catalogTry, setCatalogTry] = useState(0);
  useEffect(() => {
    let live = true;
    setCatalogStatus('loading');
    // A failure used to be swallowed, so an empty list meant "loading" or "failed" with no way to tell.
    loadCatalog().then(c => { if (live) { setCatalog(c); setCatalogStatus('ready'); } }).catch(() => { if (live) setCatalogStatus('failed'); });
    return () => { live = false; };
  }, [catalogTry]);
  const reloadCatalog = useCallback(() => setCatalogTry(n => n + 1), []);

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
    let gone: Food | undefined;
    setState(s => { gone = s.foods.find(f => f.id === id); return { ...s, foods: s.foods.filter(f => f.id !== id) }; });
    if (showcase) return { ok: true };
    const r = await deleteFood(id).catch(() => ({ ok: false }));
    // Not deleted on the server: put it back, or it would reappear on the next load with no explanation.
    if (!r.ok && gone) upsertLocal(gone);
    return { ok: r.ok };
  }, [showcase]); // eslint-disable-line react-hooks/exhaustive-deps

  const hiddenIds = data?.hiddenFoods;
  const [shown, hidden] = useMemo(() => {
    const h = new Set(hiddenIds ?? []);
    return [catalog.filter(f => !h.has(f.id)), catalog.filter(f => h.has(f.id))];
  }, [catalog, hiddenIds]);
  const setHidden = (ids: string[]) => { if (data && onDataChange) onDataChange({ ...data, hiddenFoods: ids }); };
  const hide = (id: string) => setHidden([...new Set([...(hiddenIds ?? []), id])]);
  const unhide = (id: string) => setHidden((hiddenIds ?? []).filter(x => x !== id));

  return { ...state, catalog: shown, catalogStatus, reloadCatalog, hidden, hide, unhide, save, remove };
}
