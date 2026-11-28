import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info, Loader2, Pencil, Plus, Sparkles, Trash2, Watch } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { AppData, LogTracker } from '@/lib/types';
import { addDays, findTracker } from '@/lib/fitness';
import { direction, isDerived, meets, series, stats, type Direction } from '@/lib/tracker-stats';
import { getLogInsights, type GetLogInsightsOutput } from '@/ai/flows/get-log-insights';
import { useModelFor } from '@/hooks/use-model-store';
import { useAsk } from '@/hooks/use-ask';
import { fmtSleep } from './Ring';

const RANGES = [{ days: 7, label: '7D' }, { days: 30, label: '30D' }, { days: 90, label: '90D' }, { days: 365, label: '1Y' }];
const tip = { background: 'var(--f-card)', border: '1px solid var(--f-line)', borderRadius: 12, color: 'var(--f-ink)' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortDate = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** What the number means, in plain words (general guidance, not medical advice). */
const INFO: Record<string, string> = {
  steps: 'Daily steps from your Fitbit. Around 7,000–10,000 a day is linked with lower health risk; a steady habit beats one big day.',
  sleep: 'Time actually asleep (not time in bed), to the minute as Fitbit measured it, credited to the day you woke up. Naps that day are added. Adults do best on 7–9 hours.',
  restingHr: 'Your heart rate at rest, measured overnight. Lower usually means fitter. A rise of 5+ bpm over your normal often points to stress, illness, alcohol or short sleep. Typical adults: 60–100 bpm.',
  hrv: 'Heart rate variability: how much the gap between beats varies while you sleep. Above your own baseline means good recovery. Compare with yourself, not others.',
  spo2: 'Blood oxygen while you sleep. 95–100% is typical and brief dips are normal. Fitbit’s reading is an estimate, not a medical test.',
  breaths: 'Breaths per minute while asleep. 12–20 is typical; a sudden rise above your normal can come before you feel ill.',
  azm: 'Minutes in fat-burn, cardio or peak heart-rate zones (cardio and peak count double). WHO suggests 150 a week, about 22 a day.',
  burned: 'Everything you burned: resting burn plus activity. Fitbit’s measured number when synced, else worked out from your profile, steps and workouts.',
  distance: 'Distance covered from your steps and tracked workouts.',
  weight: 'Weight swings day to day with water and food; the weekly trend is what counts. Weigh at the same time each morning.',
  intake: 'Calories from the meals you log on this page.',
  protein: 'Protein from the meals you log. Around 1.6 g per kg of body weight a day helps keep muscle while losing fat.',
};

function infoKey(data: AppData, t: LogTracker): string | undefined {
  if (t.healthMetric) return t.healthMetric;
  if (t === findTracker(data, 'intake')) return 'intake';
  if (t === findTracker(data, 'protein')) return 'protein';
  if (t === findTracker(data, 'weight')) return 'weight';
  return undefined;
}

/** Fitbit/derived daily totals read as bars (and have a period total); levels (weight, heart rate…) read as a line. */
function shape(data: AppData, t: LogTracker) {
  const sum = ['steps', 'burned', 'azm', 'distance'].includes(t.healthMetric ?? '') || isDerived(data, t) || !!t.isFlippable;
  return { bars: sum || t.healthMetric === 'sleep', total: sum };
}

/** Delete with a second tap instead of a pop-up: the first tap arms it for a few seconds. */
export function ConfirmDelete({ label, confirm, onConfirm, className = '' }: { label: string; confirm: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" className={`f-pill ${armed ? '!border-transparent !bg-[var(--f-coral)] !text-white' : ''} ${className}`} aria-live="polite"
      onClick={() => (armed ? onConfirm() : setArmed(true))}>
      <Trash2 className="h-4 w-4" aria-hidden />{armed ? confirm : label}
    </button>
  );
}

/** One tracker in full: latest vs your normal, a chart over 7 days to a year, the numbers that matter, what it means, and logging/editing. */
export function TrackerSheet({ tracker, data, day, today, aiDisabled, onClose, onChange, onDelete }: {
  tracker: LogTracker | null; data: AppData; day: string; today: string; aiDisabled?: boolean;
  onClose: () => void; onChange: (patch: Partial<LogTracker>) => void; onDelete: () => void;
}) {
  return (
    <Sheet open={!!tracker} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="fit-ui f-sheet max-h-[calc((100dvh-var(--kb,0px))*0.92)] overflow-y-auto rounded-t-[28px] border-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 sm:mx-auto sm:max-w-2xl">
        {tracker && <Body key={tracker.id} t={tracker} data={data} day={day} today={today} aiDisabled={aiDisabled} onChange={onChange} onDelete={onDelete} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ t, data, day, today, aiDisabled, onChange, onDelete }: {
  t: LogTracker; data: AppData; day: string; today: string; aiDisabled?: boolean; onChange: (patch: Partial<LogTracker>) => void; onDelete: () => void;
}) {
  const selectedModel = useModelFor('summaries');
  const [days, setDays] = useState(30);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState({ date: day, value: '' });
  const ai = useAsk<GetLogInsightsOutput>(); // lib/ask: idle → pending → ready | failed

  const isSleep = t.healthMetric === 'sleep';
  const derived = isDerived(data, t);
  const { bars, total: hasTotal } = shape(data, t);
  const fmt = (n: number) => (isSleep ? fmtSleep(n) : Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 10) / 10));
  const withUnit = (n: number) => (isSleep ? fmtSleep(n) : `${fmt(n)} ${t.unit}`);

  const partialToday = hasTotal && day === today;
  const v = useMemo(() => {
    const points = series(data, t, day, days);
    const year = series(data, t, day, 365);
    const latest = [...year].reverse().find(p => p.value != null) as { date: string; value: number } | undefined;
    const dir: Direction = direction(data, t, latest?.value);
    // A daily total for today is still filling up: keep it out of the averages, best/lowest and streak.
    const statPoints = partialToday ? points.slice(0, -1) : points;
    const s = stats(statPoints, t.goal, dir);
    const base = stats(series(data, t, partialToday ? addDays(day, -1) : day, 30), t.goal, dir).avg; // "your normal": the last 30 full days
    // A year of daily bars is a smear: weekly averages instead.
    const step = days > 90 ? 7 : 1;
    const chart = [];
    for (let i = 0; i < points.length; i += step) {
      const chunk = points.slice(i, i + step), vals = chunk.map(p => p.value).filter((x): x is number => x != null);
      const roll = s.rolling.slice(i, i + step).filter((x): x is number => x != null);
      chart.push({ date: chunk[0].date, value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined, avg: step === 1 ? s.rolling[i] ?? undefined : roll.at(-1) });
    }
    return { points, latest, dir, s, base, chart, step, span: statPoints.length };
  }, [data, t, day, days, partialToday]);

  const { latest, dir, s, base } = v;
  const tone = (delta: number) => (dir === 'neutral' || Math.abs(delta) < 1e-9 ? '' : (delta > 0) === (dir === 'up') ? 'f-good' : 'f-bad');
  const info = INFO[infoKey(data, t) ?? ''];
  const inProgress = partialToday && latest?.date === day;
  const latestLabel = latest ? (latest.date === day ? (inProgress ? 'Today so far' : 'Today') : shortDate(latest.date)) : '';
  const vsBase = latest && base != null ? latest.value - base : null;

  // Entries in range, newest first, with where each came from.
  const rows = v.points.filter(p => p.value != null).reverse().map(p => {
    const e = t.logs.find(l => l.date === p.date);
    const source = e?.id.startsWith('fitbit-') ? 'Fitbit' : e?.id.startsWith('auto-') || !e ? (t === findTracker(data, 'burned') ? 'Worked out' : 'From meals') : 'You';
    return { date: p.date, value: p.value!, entry: e, source };
  });
  const shown = showAll ? rows : rows.slice(0, 7);

  const formValue = Number(form.value);
  const existing = t.logs.find(l => l.date === form.date);
  const canSave = form.date && form.date <= day && form.value.trim() !== '' && Number.isFinite(formValue) && formValue >= 0;
  const saveEntry = () => {
    if (!canSave) return;
    // Sleep is typed in hours, as the tracker stores it.
    onChange({ logs: [...t.logs.filter(l => l.date !== form.date), { id: uuidv4(), date: form.date, value: formValue }].sort((a, b) => a.date.localeCompare(b.date)) });
    setForm({ date: day, value: '' });
  };

  const askAi = () => void ai.run(() => {
    const history = series(data, t, day, 30).filter(p => p.value != null).map(p => ({ date: p.date, value: Math.round(p.value! * 100) / 100, notes: t.logs.find(l => l.date === p.date)?.notes ?? '' }));
    return getLogInsights({ trackerName: t.name, unit: t.unit, goal: t.goal, logHistory: history }, selectedModel);
  }, { error: 'Couldn’t get insights right now. Try again in a moment.' });

  const words = t.name.trim().split(' ');
  const statTile = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="rounded-2xl bg-[var(--f-tint)] p-3">
      <p className="f-muted text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="f-muted text-xs">{sub}</p>}
    </div>
  );
  const best = dir === 'down' ? s.low : s.high, worst = dir === 'down' ? s.high : s.low;
  const wk = s.weekday.map((x, i) => ({ d: DOW[i], x })).filter(w => w.x != null) as { d: string; x: number }[];
  const showWeekday = days >= 30 && wk.length >= 5;
  const wkMax = wk.length ? wk.reduce((m, w) => (w.x > m.x ? w : m)) : undefined;
  const wkMin = wk.length ? wk.reduce((m, w) => (w.x < m.x ? w : m)) : undefined;
  // Daily totals scale from 0; levels (58–62 bpm) from just under their lowest, or every bar looks the same.
  const wkTop = wkMax?.x ?? 0, wkBottom = hasTotal || !wkMin || !wkMax ? 0 : wkMin.x - (wkMax.x - wkMin.x) * 0.6;
  const wkHeight = (x: number | null) => (x == null || wkTop <= wkBottom ? 2 : 6 + ((x - wkBottom) / (wkTop - wkBottom)) * 66);

  return (
    <div className="space-y-4">
      <div>
        <SheetTitle className="pr-10 fit-display text-[2rem] text-[var(--f-ink)]">
          {words.length > 1 ? <>{words.slice(0, -1).join(' ')} <em>{words.at(-1)}</em></> : <em>{t.name}</em>}
        </SheetTitle>
        <SheetDescription className="pr-10 f-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {t.healthMetric && <span className="inline-flex items-center gap-1"><Watch className="h-3.5 w-3.5" aria-hidden />Fitbit</span>}
          <span>{isSleep ? 'hours asleep' : t.unit}</span>
          {dir !== 'neutral' && <span>· {dir === 'up' ? 'higher is better' : 'lower is better'}</span>}
        </SheetDescription>
      </div>

      {/* Latest vs your normal */}
      <section className="f-hero p-5" aria-label="Latest">
        <p className="f-muted text-xs font-semibold uppercase tracking-[0.14em]">{latest ? `Latest · ${latestLabel}` : 'Latest'}</p>
        <p className="fit-display mt-1 text-[3rem] tabular-nums">
          {latest ? fmt(latest.value) : '—'}
          {latest && !isSleep && <span className="f-muted ml-1.5 font-sans text-base font-semibold">{t.unit}</span>}
        </p>
        {vsBase != null && base != null && (
          <p className={`text-sm font-semibold ${inProgress ? 'f-muted' : tone(vsBase)}`}>
            {Math.abs(vsBase) < 1e-9 ? 'Right on your 30-day average' : `${vsBase > 0 ? '▲' : '▼'} ${withUnit(Math.abs(vsBase))} ${vsBase > 0 ? 'above' : 'below'} your 30-day average (${fmt(base)})`}
          </p>
        )}
        {t.goal != null && latest && (
          <p className="mt-1 text-sm">
            <span className="f-muted">Goal {withUnit(t.goal)} · </span>
            <span className={`font-semibold ${meets(latest.value, t.goal, dir) ? 'f-good' : ''}`}>
              {meets(latest.value, t.goal, dir) ? 'on goal ✓' : `${withUnit(Math.abs(t.goal - latest.value))} ${isSleep ? 'short' : 'to go'}`}
            </span>
          </p>
        )}
      </section>

      {/* Range + chart */}
      <section className="f-card p-4" aria-label="History">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">History</h3>
          <div className="flex gap-1" role="group" aria-label="Range">
            {RANGES.map(r => (
              <button key={r.days} type="button" className="f-chip !px-3" data-on={days === r.days} aria-pressed={days === r.days} onClick={() => { setDays(r.days); setShowAll(false); }}>{r.label}</button>
            ))}
          </div>
        </div>
        {s.n === 0 ? <p className="f-muted py-10 text-center text-sm">Nothing in the last {days} days.</p> : (
          <div className="mt-3 h-48" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={v.chart} margin={{ top: 6, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--f-line)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24}
                  tickFormatter={d => (days === 7 ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }) : shortDate(d))} />
                <YAxis tickLine={false} axisLine={false} width={48} domain={bars ? [0, 'auto'] : ['auto', 'auto']}
                  tickFormatter={(n: number) => (isSleep ? `${Math.round(n)}h` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10))} />
                <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }} labelFormatter={d => (v.step > 1 ? `Week of ${shortDate(String(d))}` : shortDate(String(d)))}
                  formatter={(n: number, name: string) => [withUnit(n), name === 'avg' ? '7-day average' : v.step > 1 ? 'Weekly average' : t.name]} />
                {t.goal != null && <ReferenceLine y={t.goal} stroke="var(--f-good)" strokeDasharray="4 4" />}
                {bars
                  ? <Bar dataKey="value" fill={isSleep ? 'var(--f-sleep)' : 'var(--f-accent)'} fillOpacity={0.55} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  : <Line dataKey="value" type="monotone" stroke="var(--f-accent)" strokeOpacity={0.5} strokeWidth={1.5} dot={{ r: days <= 30 ? 2.5 : 0, fill: 'var(--f-accent)' }} connectNulls isAnimationActive={false} />}
                <Line dataKey="avg" type="monotone" stroke={isSleep ? 'var(--f-sleep)' : 'var(--f-deep)'} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="f-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-[var(--f-deep)]" />7-day average</span>
          {t.goal != null && <span className="inline-flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-[var(--f-good)]" />Goal</span>}
          {v.step > 1 && <span>Bars are weekly averages</span>}
        </div>
      </section>

      {/* The numbers */}
      {s.n > 0 && (
        <section aria-label={`Last ${days} days`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {statTile('Average', withUnit(s.avg!), `per logged day`)}
          {hasTotal && statTile('Total', withUnit(s.total), partialToday ? `${v.span} full days` : `${days} days`)}
          {best && statTile(dir === 'down' ? 'Lowest' : 'Best', withUnit(best.value), shortDate(best.date))}
          {worst && statTile(dir === 'down' ? 'Highest' : 'Lowest', withUnit(worst.value), shortDate(worst.date))}
          {statTile('Logged', `${s.n} of ${v.span} days`, `${Math.round((s.n / Math.max(v.span, 1)) * 100)}% consistency`)}
          {s.goalDays != null && statTile('On goal', `${s.goalDays} of ${s.n} days`, s.streak ? `${s.streak}-day streak now` : 'No streak right now')}
          {s.perWeek != null && statTile('Trend', <span className={tone(s.perWeek)}>{Math.abs(s.perWeek) < 1e-6 ? 'Flat' : `${s.perWeek > 0 ? '▲' : '▼'} ${withUnit(Math.abs(s.perWeek))}`}</span>, 'per week, line of best fit')}
        </section>
      )}

      {showWeekday && wkMax && wkMin && (
        <section className="f-card p-4" aria-label="By weekday">
          <h3 className="text-sm font-semibold">By weekday</h3>
          <p className="f-muted text-xs">Highest on {wkMax.d}s ({withUnit(wkMax.x)}), lowest on {wkMin.d}s ({withUnit(wkMin.x)}).</p>
          <div className="mt-3 flex h-24 items-end gap-2" aria-hidden>
            {s.weekday.map((x, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md" style={{ height: `${wkHeight(x)}px`, background: DOW[i] === wkMax.d ? 'var(--f-deep)' : 'color-mix(in srgb, var(--f-accent) 40%, transparent)' }} />
                <span className="f-muted text-[10px]">{DOW[i].slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {info && (
        <section className="flex gap-3 rounded-2xl border border-[var(--f-line)] p-4" aria-label="What this means">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--f-deep)]" aria-hidden />
          <p className="text-sm leading-relaxed">{info}</p>
        </section>
      )}

      {/* Log or correct a day */}
      {derived ? (
        <p className="f-muted text-sm">{t === findTracker(data, 'burned') ? 'Worked out for you each day, so there’s nothing to type here.' : 'Filled in from the meals you log, so edit the meals to change it.'}</p>
      ) : (
        <section className="f-card space-y-2 p-4" aria-label="Log a value">
          <h3 className="text-sm font-semibold">Log or correct a day</h3>
          <div className="flex flex-wrap gap-2">
            <input type="date" className="f-input w-auto flex-1" max={day} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} aria-label="Day" />
            <input type="number" inputMode="decimal" step="any" min={0} className="f-input w-32" placeholder={isSleep ? 'hours, e.g. 7.5' : t.unit} value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveEntry()} aria-label={`Value in ${isSleep ? 'hours' : t.unit}`} />
          </div>
          {existing && (
            <p className="f-muted text-xs">Replaces {withUnit(existing.value)}{existing.id.startsWith('fitbit-') ? ' from Fitbit. Your value stays even after the next sync.' : '.'}</p>
          )}
          <button type="button" className="f-pill f-pill-primary w-full" disabled={!canSave} onClick={saveEntry}><Plus className="h-4 w-4" aria-hidden />Save</button>
        </section>
      )}

      {/* Entries */}
      {rows.length > 0 && (
        <section aria-label="Entries">
          <h3 className="mb-2 text-sm font-semibold">Entries <span className="f-muted font-normal">· last {days} days</span></h3>
          <ul className="f-card overflow-hidden">
            {shown.map(r => (
              <li key={r.date} className="f-row">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{new Date(`${r.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="f-muted block text-xs">{r.source}{r.entry?.notes ? ` · ${r.entry.notes}` : ''}</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${t.goal != null ? (meets(r.value, t.goal, dir) ? 'f-good' : '') : ''}`}>{withUnit(r.value)}</span>
                {!derived && (
                  <button type="button" className="f-muted flex h-11 w-9 items-center justify-center" aria-label={`Change ${shortDate(r.date)}`}
                    onClick={() => setForm({ date: r.date, value: String(Math.round(r.value * 1000) / 1000) })}><Pencil className="h-4 w-4" /></button>
                )}
                {!derived && r.source === 'You' && r.entry && (
                  <button type="button" className="f-muted flex h-11 w-9 items-center justify-center" aria-label={`Delete ${shortDate(r.date)}`}
                    onClick={() => onChange({ logs: t.logs.filter(l => l.id !== r.entry!.id) })}><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
          {rows.length > 7 && (
            <button type="button" className="f-chip mt-2" onClick={() => setShowAll(x => !x)}>{showAll ? 'Show fewer' : `Show all ${rows.length}`}</button>
          )}
        </section>
      )}

      {/* AI coach */}
      <section className="space-y-2 rounded-2xl bg-[var(--f-tint)] p-4" aria-label="AI coach">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[var(--f-deep)]" aria-hidden />AI coach</span>
        {ai.value ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{ai.value.feedback}</p>
            <p className="f-muted text-xs">Trend: {ai.value.trend}{ai.value.modelId ? ` · ${ai.value.modelId}` : ''}</p>
          </>
        ) : <p className="f-muted text-sm">An honest read of your last 30 days, with what to do next.</p>}
        {ai.error && <p className="f-bad text-sm" aria-live="polite">{ai.error}</p>}
        <button type="button" className="f-pill w-full" disabled={aiDisabled || ai.pending || series(data, t, day, 30).filter(p => p.value != null).length < 2} onClick={() => void askAi()}>
          {ai.pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{ai.pending ? 'Thinking…' : ai.value ? 'Ask again' : 'Get insights'}
        </button>
      </section>

      {/* Settings */}
      <section className="f-card flex flex-wrap items-end gap-3 p-4" aria-label="Tracker settings">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Goal{isSleep ? ' (hours)' : ` (${t.unit})`}</span>
          <input key={t.goal ?? 'none'} className="f-input" type="number" inputMode="decimal" step="any" min={0} defaultValue={t.goal ?? ''} placeholder="No goal"
            onBlur={e => { const raw = e.target.value.trim(), n = Number(raw); const next = raw === '' ? undefined : Number.isFinite(n) && n > 0 ? n : t.goal; if (next !== t.goal) onChange({ goal: next }); }} />
        </label>
        <ConfirmDelete label="Delete tracker" confirm={`Tap again: delete ${t.logs.length} entries`} onConfirm={onDelete} />
      </section>
    </div>
  );
}
