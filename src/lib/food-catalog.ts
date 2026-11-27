// The built-in food catalogue ("All foods"): a static file shipped with the app,
// so it takes no database space and works offline. Built by
// `npx tsx scripts/build-food-catalog.mts` from data/food-research/*.json
// (every value there carries its source). Loaded lazily, the first time the
// foods panel or the log sheet needs it.
import type { Food } from '@/lib/food-match';

export const INGREDIENTS = 'Ingredients';
/** branded: from a product label (auto-logs only when named, e.g. "amul lassi", not "lassi"). */
export type CatalogFood = Food & { group: string; branded?: boolean };

/** Compact on-disk row: id, name, group index, unit, kcal, protein, carbs, fat, fibre, aliases?, servings?, branded (1)? */
type Row = [string, string, number, Food['unit'], number, number, number, number, number, string[]?, [string, number][]?, 1?];
export type CatalogFile = { groups: string[]; rows: Row[] };

export const fromFile = (file: CatalogFile): CatalogFood[] => file.rows.map(([id, name, g, unit, kcal, proteinG, carbsG, fatG, fiberG, aliases, servings, branded]) => ({
  id, name, group: file.groups[g], ...(branded ? { branded: true } : {}), unit, kcal, proteinG, carbsG, fatG, fiberG, aliases: aliases ?? [], servings: (servings ?? []).map(([label, amount]) => ({ label, amount })),
}));

let cached: Promise<CatalogFood[]> | null = null;
export function loadCatalog(): Promise<CatalogFood[]> {
  cached ??= import('@/data/food-catalog.json').then(m => fromFile(m.default as unknown as CatalogFile)).catch(e => { cached = null; throw e; });
  return cached;
}

/** For typed auto-matching and AI hints: everything except raw ingredients ("200 g dal" must not log raw dal). */
export const matchable = (c: CatalogFood[]) => c.filter(f => f.group !== INGREDIENTS);
