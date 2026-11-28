// Run: npx tsx src/lib/link-analysis.check.ts
import assert from 'node:assert/strict';
import { ANALYZING, ANALYSIS_FAILED, analysisPatch, hostOf, isAnalyzing, linkAnalysis } from './link-analysis';
import type { SavedLink } from './types';

const placeholder: SavedLink = { id: 'a', url: 'https://example.com/x', title: 'example.com', summary: ANALYZING, category: 'Other', dateAdded: '2026-11-28T00:00:00.000Z' };
const analyzed: SavedLink = { ...placeholder, title: 'Example', summary: 'An example page.', category: 'Article' };

// The stored value is unchanged: the text links were always saved with while the AI works.
assert.equal(ANALYZING, 'Analyzing…');
assert.equal(isAnalyzing(placeholder), true);
assert.equal(isAnalyzing(analyzed), false);

// Status: stored text + what this screen is actually running.
assert.equal(linkAnalysis(placeholder, ['a']), 'running');
assert.equal(linkAnalysis(placeholder, []), 'stalled', 'saved as analyzing, but nothing is running (tab closed, page left)');
assert.equal(linkAnalysis(placeholder, ['b']), 'stalled');
assert.equal(linkAnalysis(analyzed, []), 'done');
assert.equal(linkAnalysis(analyzed, ['a']), 'done');

// A reply fills in, field by field, whatever still holds its placeholder; a field the user has set is kept.
const found = { title: 'Example', summary: 'An example page.', category: 'Article' as const, model: 'm' as SavedLink['model'] };
assert.equal(hostOf('https://www.example.com/x'), 'example.com');
assert.equal(hostOf('not a url'), 'not a url');
assert.deepEqual(analysisPatch(placeholder, found), { patch: found, kept: false });
assert.equal(analysisPatch(undefined, found), null, 'deleted meanwhile');
// Edited the title while the AI worked: the title stays, the rest is filled in, and the link is no longer "Analyzing…".
assert.deepEqual(analysisPatch({ ...placeholder, title: 'My title' }, found), { patch: { summary: found.summary, category: found.category, model: found.model }, kept: true });
assert.deepEqual(analysisPatch({ ...placeholder, summary: 'my notes', category: 'Video' }, found), { patch: { title: 'Example', model: found.model }, kept: true });
assert.deepEqual(analysisPatch({ ...placeholder, title: 'T', summary: 'S', category: 'Video' }, found), { patch: {}, kept: true }, 'everything set by hand: nothing applied');
// The analysis failed: the placeholder summary is replaced so the link doesn't stay "Analyzing…"; notes the user wrote are left.
assert.deepEqual(analysisPatch({ ...placeholder, title: 'My title' }, null), { patch: { summary: ANALYSIS_FAILED }, kept: false });
assert.equal(analysisPatch({ ...placeholder, summary: 'my notes' }, null), null);
// Whatever happens, a link whose summary was still the placeholder never keeps it.
for (const now of [placeholder, { ...placeholder, title: 'x' }, { ...placeholder, category: 'Video' as const }])
  for (const f of [found, null]) assert.equal(isAnalyzing({ ...now, ...analysisPatch(now, f)!.patch }), false);
console.log('link-analysis: all checks passed');
