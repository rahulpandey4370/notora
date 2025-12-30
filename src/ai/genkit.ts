import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import { ModelId, modelNames } from '@/lib/types';


export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash-latest',
});
