// A saved link's AI analysis as named states. The status is stored in the link itself (`summary` holds ANALYZING
// while the AI works); that stored shape is unchanged. Pure; checked by `npx tsx src/lib/link-analysis.check.ts`.
import type { SavedLink } from './types';

/** The summary a link is saved with while the AI reads it. */
export const ANALYZING = 'Analyzing…';

export const isAnalyzing = (link: Pick<SavedLink, 'summary'>) => link.summary === ANALYZING;

export type LinkAnalysis =
  /** This screen has a request out for it. */
  | 'running'
  /** Saved as analyzing, but nothing is running (the tab was closed or the page left mid-analysis): offer a retry. */
  | 'stalled'
  | 'done';

export function linkAnalysis(link: Pick<SavedLink, 'id' | 'summary'>, running: readonly string[]): LinkAnalysis {
  if (!isAnalyzing(link)) return 'done';
  return running.includes(link.id) ? 'running' : 'stalled';
}

export type AnalysisFate =
  | 'apply'
  /** Deleted meanwhile. */
  | 'gone'
  /** The user edited the link while the AI worked: typing wins, the reply is dropped. */
  | 'edited';

/** What to do with an analysis reply: `started` is the link when the request went out, `now` is what's stored. */
export function analysisFate(started: SavedLink, now: SavedLink | undefined): AnalysisFate {
  if (!now) return 'gone';
  return now.title !== started.title || now.summary !== started.summary || now.category !== started.category ? 'edited' : 'apply';
}
