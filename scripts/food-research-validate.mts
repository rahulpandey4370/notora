// Checks food research files (format: data/food-research/README.md).
// Run: npx tsx scripts/food-research-validate.mts <file.json> [...]   (exit 1 on any error)
import { readFileSync } from 'node:fs';

export type Item = {
  name: string; brand?: string; group: string; aliases?: string[];
  unit: 'g' | 'ml' | 'serving';
  kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null;
  servings?: { label: string; amount: number }[];
  source: string; sourceBasis: string; quote: string; energyNote?: string;
};
export type ResearchFile = { items: Item[]; notFound?: { name: string; reason: string }[] };

/** Errors (must fix) and warnings (explained by an energyNote) for one research file. */
export function check(file: ResearchFile): { errs: string[]; warns: string[] } {
  const names = new Set<string>();
  const errs: string[] = [], warns: string[] = [];
  for (const [i, it] of (file.items ?? []).entries()) {
    const at = `#${i} ${it?.name ?? '?'}`;
    const e = (m: string) => errs.push(`${at}: ${m}`);
    if (!it.name?.trim()) e('name missing');
    if (names.has(it.name?.toLowerCase())) e('duplicate name');
    names.add(it.name?.toLowerCase());
    if (!it.group?.trim()) e('group missing');
    if (!['g', 'ml', 'serving'].includes(it.unit)) e(`unit must be g|ml|serving, got ${it.unit}`);
    for (const k of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) if (typeof it[k] !== 'number' || !(it[k] >= 0)) e(`${k} must be a number ≥ 0`);
    if (it.fiberG !== null && (typeof it.fiberG !== 'number' || it.fiberG < 0)) e('fiberG must be a number ≥ 0 or null (not on label)');
    if (!/^https?:\/\/\S+$/.test(it.source ?? '')) e('source must be a URL');
    if (!it.sourceBasis?.trim()) e('sourceBasis missing');
    if (!it.quote?.trim() || it.quote.length < 15) e('quote missing (copy the label/table line you read)');
    for (const s of it.servings ?? []) if (!s.label?.trim() || !(s.amount > 0)) e(`bad serving ${JSON.stringify(s)}`);
    if (it.unit === 'serving' && it.servings?.length) e('per-serving foods take no servings list');
    const fb = it.fiberG ?? 0;
    if (it.unit !== 'serving') {
      if (it.kcal > 902) e(`kcal ${it.kcal} per 100 > 900: kJ, or per-serving stored as per-100?`);
      // Indian labels count fibre inside total carbohydrate, so fibre isn't added here.
      if (it.proteinG + it.carbsG + it.fatG > 101) e('macros sum over 100 g per 100: per-serving or wrong basis?');
    }
    const atw = 4 * it.proteinG + 4 * it.carbsG + 9 * it.fatG;
    const best = Math.min(Math.abs(it.kcal - atw), Math.abs(it.kcal - (atw + 2 * fb)));
    const tol = Math.max(0.15 * it.kcal, 20);
    if (best > tol) (it.energyNote?.trim() ? warns : errs).push(`${at}: kcal ${it.kcal} vs 4P+4C+9F ${Math.round(atw)} (off by ${Math.round(best)})${it.energyNote ? ` — note: ${it.energyNote}` : ' — recheck, or add energyNote explaining (e.g. polyols)'}`);
  }
  return { errs, warns };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  for (const path of process.argv.slice(2)) {
    const file = JSON.parse(readFileSync(path, 'utf8')) as ResearchFile;
    const { errs, warns } = check(file);
    console.log(`${path}: ${file.items?.length ?? 0} items, ${file.notFound?.length ?? 0} not found, ${errs.length} errors, ${warns.length} warnings`);
    for (const m of errs) console.log('  ERROR', m);
    for (const m of warns) console.log('  warn ', m);
    if (errs.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
