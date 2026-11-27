// Builds src/data/food-catalog.json (the app's built-in "All foods") from the
// sourced research files in data/food-research/*.json. Every item must pass
// scripts/food-research-validate.mts; the build stops on any error.
// Run: npx tsx scripts/build-food-catalog.mts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { check, type ResearchFile } from './food-research-validate.mts';

const DIR = 'data/food-research';
const items: (ResearchFile['items'][number] & { file: string })[] = [];
let failed = false;
const OUT = 'src/data/food-catalog.json';
// Display order; groups not listed go before Ingredients, which is always last (shown collapsed).
const ORDER = ['Rice, roti & dal', 'Dairy', 'Eggs', 'Chicken', 'Veg sabji', 'Fruits', 'Vegetables', 'Breads', 'Bakery', 'Staples',
  'Breakfast & cereals', 'Breakfast & spreads', 'Protein supplements', 'Protein bars', 'Biscuits & cookies', 'Chips & namkeen',
  'Chocolates & sweets', 'Ice cream & desserts', 'Dry fruits & nuts', 'Instant noodles', 'Noodles, pasta & soups', 'Frozen & ready to eat',
  'Sauces & spreads', 'Drinks', "Domino's", 'Noice'];
const INGREDIENTS = 'Ingredients';
const GENERIC_FILES = ['ifct.json', 'home-cooked.json'];

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const r1 = (n: number) => Math.round(n * 10) / 10;

// servings.json: sourced serving weights for foods whose nutrition source gives none (fruits, vegetables…).
type ServingsFile = { servings: Record<string, { label: string; amount: number; source: string; quote: string }[]> };
let extraServings: ServingsFile['servings'] = {};
try { extraServings = (JSON.parse(readFileSync(`${DIR}/servings.json`, 'utf8')) as ServingsFile).servings; } catch { /* none yet */ }
for (const [name, list] of Object.entries(extraServings)) for (const s of list) {
  if (!s.label?.trim() || !(s.amount > 0) || !/^https?:\/\//.test(s.source ?? '') || !s.quote?.trim()) { failed = true; console.error(`servings.json ${name}: bad serving ${JSON.stringify(s)}`); }
}

for (const f of readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'servings.json').sort()) {
  const file = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as ResearchFile;
  const { errs } = check(file);
  if (errs.length) { failed = true; console.error(`${f}:\n  ${errs.join('\n  ')}`); }
  items.push(...file.items.map(it => ({ ...it, file: f })));
}
for (const name of Object.keys(extraServings)) {
  const it = items.find(i => i.name === name);
  if (!it) { console.warn(`servings.json: no food named "${name}" yet (skipped)`); continue; }
  if (it.unit === 'serving') continue;
  const have = new Set((it.servings ?? []).map(s => s.label.toLowerCase()));
  it.servings = [...(it.servings ?? []), ...extraServings[name].filter(s => !have.has(s.label.toLowerCase())).map(({ label, amount }) => ({ label, amount }))];
}
if (failed) process.exit(1);

const ids = new Map<string, string>();
for (const it of items) {
  const id = `cat-${slug(it.name)}`;
  if (ids.has(id)) { console.error(`Duplicate catalogue name "${it.name}" in ${it.file} and ${ids.get(id)}`); process.exit(1); }
  ids.set(id, it.file);
}

// Branded servings smallest first: a bare count ("1 pepsi") logs the smallest pack, shown in the draft to change.
// Generic foods keep their source's order (typical size first: "1 apple" is a medium apple).
for (const it of items) if (!GENERIC_FILES.includes(it.file)) it.servings = [...(it.servings ?? [])].sort((x, y) => x.amount - y.amount);

const present = [...new Set(items.map(i => i.group))];
const groups = [...ORDER.filter(g => present.includes(g)), ...present.filter(g => !ORDER.includes(g) && g !== INGREDIENTS).sort(), ...(present.includes(INGREDIENTS) ? [INGREDIENTS] : [])];
const rows = items
  .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.name.localeCompare(b.name))
  .map(it => {
    const row: unknown[] = [`cat-${slug(it.name)}`, it.name, groups.indexOf(it.group), it.unit, Math.round(it.kcal), r1(it.proteinG), r1(it.carbsG), r1(it.fatG), r1(it.fiberG ?? 0)];
    const aliases = [...new Set((it.aliases ?? []).map(a => a.trim()).filter(a => a && a.toLowerCase() !== it.name.toLowerCase()))];
    const servings = (it.servings ?? []).map(s => [s.label, s.amount]);
    // Branded (label-sourced) foods only auto-log when named; generic table foods (IFCT, INDB) also by their common name.
    const branded = !GENERIC_FILES.includes(it.file);
    if (aliases.length || servings.length || branded) row.push(aliases);
    if (servings.length || branded) row.push(servings);
    if (branded) row.push(1);
    return row;
  });

writeFileSync(OUT, `${JSON.stringify({ groups, rows }).replace(/\],\[/g, '],\n[')}\n`);
const noServing = items.filter(i => i.unit !== 'serving' && i.group !== INGREDIENTS && !i.servings?.length).map(i => i.name);
if (noServing.length) console.log(`No serving size (log by grams/ml): ${noServing.length} — ${noServing.slice(0, 30).join('; ')}${noServing.length > 30 ? '…' : ''}`);
const counts = groups.map(g => `${g} ${items.filter(i => i.group === g).length}`).join(', ');
console.log(`${OUT}: ${rows.length} foods (${counts})`);
