// Run: npx tsx src/lib/link-analysis.check.ts
import assert from 'node:assert/strict';
import { ANALYZING, isAnalyzing, linkAnalysis, analysisFate } from './link-analysis';
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

// A reply: applied only to the link as it was when the analysis started.
assert.equal(analysisFate(placeholder, placeholder), 'apply');
assert.equal(analysisFate(placeholder, { ...placeholder, model: 'm' as SavedLink['model'] }), 'apply', 'only the fields the user can edit count');
assert.equal(analysisFate(placeholder, undefined), 'gone', 'deleted meanwhile');
assert.equal(analysisFate(placeholder, { ...placeholder, title: 'My title' }), 'edited');
assert.equal(analysisFate(placeholder, { ...placeholder, summary: 'my notes' }), 'edited');
assert.equal(analysisFate(placeholder, { ...placeholder, category: 'Video' }), 'edited');
console.log('link-analysis: all checks passed');
