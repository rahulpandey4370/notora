'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-task-ordering.ts';
import '@/ai/flows/day-end-summary.ts';
import '@/ai/flows/summarize-sticky-note.ts';
import '@/ai/flows/polish-sticky-note.ts';
import '@/ai/flows/simplify-sticky-note.ts';
import '@/ai/flows/bullet-ify-sticky-note.ts';
import '@/ai/flows/analyze-link.ts';
import '@/ai/flows/custom-transform-sticky-note.ts';
