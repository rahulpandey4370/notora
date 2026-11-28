// What a signed-in page can show while the workspace loads: one named state instead of `loading || !data || !user`.
// Pure; checked by `npx tsx src/lib/page-gate.check.ts`.

export type PageGate<D, U> =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  /** The first load failed and nothing is cached: say so and offer Retry (it used to be a skeleton forever). */
  | { kind: 'failed' }
  | { kind: 'ready'; data: D; user: U };

export function pageGate<D, U>(i: { loading: boolean; user: U | null | undefined; data: D | null | undefined; loadFailed?: boolean }): PageGate<D, U> {
  if (i.loading) return { kind: 'loading' };
  if (!i.user) return { kind: 'signedOut' };
  if (!i.data) return { kind: i.loadFailed ? 'failed' : 'loading' };
  return { kind: 'ready', data: i.data, user: i.user };
}
