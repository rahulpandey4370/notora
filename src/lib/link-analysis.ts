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

/** The title a link is saved with while the AI reads it: its host. */
export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
/** The category a link is saved with while the AI reads it. */
export const PLACEHOLDER_CATEGORY: SavedLink['category'] = 'Other';
/** The summary a link gets when the AI couldn't read it. */
export const ANALYSIS_FAILED = 'Couldn’t analyze this link. It’s saved; tap edit to add a title and notes.';

export type AnalysisFound = Pick<SavedLink, 'title' | 'summary' | 'category'> & Pick<Partial<SavedLink>, 'model'>;

/**
 * What an analysis reply changes in the stored link (`now`), field by field: a field still holding its placeholder
 * takes the AI's value, one the user has set meanwhile is kept (`kept` says some were). `found` is null when the
 * analysis failed: then only a placeholder summary is replaced, so the link never stays "Analyzing…".
 * null: the link was deleted, or there is nothing to do.
 */
export function analysisPatch(now: SavedLink | undefined, found: AnalysisFound | null): { patch: Partial<SavedLink>; kept: boolean } | null {
  if (!now) return null;
  if (!found) return isAnalyzing(now) ? { patch: { summary: ANALYSIS_FAILED }, kept: false } : null;
  const patch: Partial<SavedLink> = {};
  if (now.title === hostOf(now.url)) patch.title = found.title;
  if (isAnalyzing(now)) patch.summary = found.summary;
  if (now.category === PLACEHOLDER_CATEGORY) patch.category = found.category;
  const filled = Object.keys(patch).length;
  if (filled && found.model !== undefined) patch.model = found.model;
  return { patch, kept: filled < 3 };
}
