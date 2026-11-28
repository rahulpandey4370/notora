// Run: npx tsx src/lib/model-catalog.check.ts
import assert from 'node:assert/strict';
import { defaultModelKey, startModelKey } from './model-catalog';

const server = ['openai', 'google', 'azure'] as const;
// The bug: the browser's first guess (no server list → Google + Azure) is Gemini 2.5 Flash,
// and it used to be kept because it was "still valid" in the server's list.
assert.equal(defaultModelKey(['google', 'azure']), 'google::gemini-2.5-flash');
assert.equal(startModelKey([...server]), 'openai::gpt-6-luna', 'no pick → GPT-6 Luna when OpenAI is on');
assert.equal(startModelKey([...server], null), 'openai::gpt-6-luna');
assert.equal(startModelKey([...server], 'google::gemini-2.5-flash'), 'google::gemini-2.5-flash', 'a real pick is kept');
assert.equal(startModelKey([...server], 'anthropic::claude-opus-5'), 'openai::gpt-6-luna', 'a pick no longer on offer falls back');
console.log('model-catalog: all checks passed');

// Per-area model: an override on offer wins; anything else falls back to the default pick.
import { availableModels, modelForArea, MODEL_AREAS } from './model-catalog';
const offer = availableModels([...server]);
assert.equal(modelForArea(offer, 'openai::gpt-6-luna', 'openai::gpt-6.2-sol'), 'openai::gpt-6.2-sol');
assert.equal(modelForArea(offer, 'openai::gpt-6-luna', undefined), 'openai::gpt-6-luna');
assert.equal(modelForArea(offer, 'openai::gpt-6-luna', 'anthropic::claude-opus-5'), 'openai::gpt-6-luna', 'a saved model no longer on offer falls back');
assert.deepEqual(MODEL_AREAS.map(a => a.id), ['food', 'chat', 'notes', 'journal', 'tasks', 'summaries']);
console.log('model areas: all checks passed');
