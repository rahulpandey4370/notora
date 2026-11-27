import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, Flame, Lightbulb, PartyPopper, Ruler, Route, Target, TrendingDown } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { findTracker, fmtSleep, goalEta } from '@/lib/fitness';
import { journey, type Journey } from '@/lib/journey';
import { kcalFloor, realBurn, targetFor, type RealBurn } from '@/lib/real-burn';
import { weeklyCheckin } from '@/lib/checkin';
import { InsightsCard } from './InsightsCard';
import Link from 'next/link';

const k = (n: number) => Math.round(n).toLocaleString('en-IN');
const short = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(unit === 'kg' ? 1 : 0)} ${unit}`;
const TABS = [
  { id: 'journey', label: 'Journey', icon: Route }, { id: 'burn', label: 'Real burn', icon: Flame }, { id: 'checkin', label: 'Check-in', icon: CalendarCheck },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
] as const;
type Tab = (typeof TABS)[number]['id'];
const KEY = 'fit-progress-tab';

function Banner({ tone, icon: Icon, children }: { tone: 'good' | 'bad' | 'warn'; icon: typeof Flame; children: React.ReactNode }) {
  const bg = tone === 'good' ? 'color-mix(in srgb, var(--f-good) 12%, transparent)' : tone === 'bad' ? 'var(--f-coral-soft)' : 'color-mix(in srgb, var(--f-sun) 22%, transparent)';
  return (
    <div className="f-banner flex gap-3 rounded-2xl p-3 text-sm leading-relaxed" style={{ background: bg }}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'good' ? 'f-good' : tone === 'bad' ? 'f-bad' : ''}`} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Start → now → goal, milestones, and what the trend is doing (celebrate, or a wake-up call). */
function JourneyCard({ j, burn, data, today }: { j: Journey | null; burn: RealBurn; data: AppData; today: string }) {
  if (!j) return <p className="f-muted text-sm">Weigh in a few times (say “94.2 kg” in Log it) to start your journey.</p>;
  const total = j.goal != null && j.start.kg > j.goal ? j.start.kg - j.goal : Math.max(10, j.lost + 2.5);
  const at = (lost: number) => `${Math.max(0, Math.min(100, (lost / total) * 100))}%`;
  const eta = goalEta(j.current.kg, j.ratePerWeek, j.goal, today);
  const floor = kcalFloor(data, today);
  const restart = burn.ok ? targetFor(burn.real, 0.5, floor).kcal : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="f-muted text-xs font-semibold uppercase tracking-[0.14em]">Since {short(j.start.date)} · {j.days} days</p>
          <p className={`fit-display mt-1 text-[2.8rem] tabular-nums ${j.lost > 0 ? 'f-good' : j.lost < 0 ? 'f-bad' : ''}`}>{j.lost > 0 ? '−' : j.lost < 0 ? '+' : ''}{Math.abs(j.lost).toFixed(1)} <span className="text-xl">kg</span></p>
          <p className="f-muted text-sm">{j.start.kg.toFixed(1)} → {j.current.kg.toFixed(1)} kg trend{j.goal != null ? ` · goal ${j.goal} kg` : ''}</p>
        </div>
        {j.pct != null && <p className="text-right"><span className="fit-display text-[2rem] tabular-nums">{Math.round(j.pct * 100)}%</span><span className="f-muted block text-xs">of the way</span></p>}
      </div>

      {/* The path: start on the left, goal on the right, a tick every 2.5 kg */}
      <div aria-hidden>
        <div className="relative h-3 rounded-full bg-[var(--f-tint)]">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--f-deep)] transition-[width] duration-700" style={{ width: at(Math.max(0, j.lost)) }} />
          {j.milestones.map(m => (
            <span key={m.lost} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: at(m.lost), background: m.reached ? 'var(--f-deep)' : 'var(--f-card)', borderColor: m.tag ? 'var(--f-sun)' : 'var(--f-deep)' }} />
          ))}
        </div>
        <div className="f-muted mt-2 flex justify-between text-[11px] tabular-nums"><span>{j.start.kg.toFixed(1)}</span><span>{j.goal != null ? `${j.goal} kg` : ''}</span></div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Milestones">
        {j.milestones.map(m => (
          <li key={m.lost} className="f-chip !min-h-8 !cursor-default" data-on={!!m.reached} title={m.reached ? `Reached ${short(m.reached)}` : `${m.kg} kg`}>
            {m.tag === 'goal' ? <Target className="h-3.5 w-3.5" aria-hidden /> : null}−{m.lost} kg{m.tag && m.tag !== 'goal' ? ` · ${m.tag}` : ''}{m.reached ? ' ✓' : ''}
          </li>
        ))}
      </ul>
      {j.next && <p className="text-sm">Next milestone: <strong>{j.next.kg} kg</strong> ({j.next.tag === 'goal' ? 'your goal' : `−${j.next.lost} kg`}), <strong>{Math.max(0, j.current.kg - j.next.kg).toFixed(1)} kg</strong> to go.</p>}

      {j.newLow && <Banner tone="good" icon={PartyPopper}><strong>New low: {j.current.kg.toFixed(1)} kg.</strong> Your lightest trend weight yet. That’s weeks of good days adding up.</Banner>}
      {j.status === 'losing' && !j.newLow && <Banner tone="good" icon={TrendingDown}>Losing <strong>{Math.abs(j.ratePerWeek!).toFixed(2)} kg a week</strong>{eta ? <>. At this pace you reach {j.goal} kg around <strong>{short(eta)}</strong>.</> : '.'}</Banner>}
      {j.status === 'plateau' && (
        <Banner tone="warn" icon={AlertTriangle}>
          <strong>Plateau.</strong> Your trend has barely moved lately. Water, salt and stress can hide fat loss for a week or two, but a longer stall means you’re eating about what you burn.
          {burn.ok && <> You’ve averaged <strong>{k(burn.avgIntake)} kcal</strong> against a real burn of <strong>{k(burn.real)}</strong>. About <strong>{k(restart!)} kcal</strong> a day restarts a 0.5 kg/week loss.</>}
        </Banner>
      )}
      {j.status === 'regaining' && (
        <Banner tone="bad" icon={AlertTriangle}>
          <strong>Wake-up call:</strong> your trend is {j.change14 != null ? `up ${signed(j.change14, 'kg')} in 2 weeks` : 'going up'}.
          {burn.ok ? <> That’s about <strong>{k(Math.max(0, burn.avgIntake - burn.real))} kcal a day</strong> over your real burn. Getting back to {k(restart!)} kcal turns it around.</> : ' Log every meal this week to find where the extra is coming from.'}
        </Banner>
      )}
      {j.status === 'early' && <p className="f-muted text-sm">Log 7+ weigh-ins in 4 weeks to see your rate and pace.</p>}
    </div>
  );
}

/** What your body really burns (intake vs trend), against Fitbit and the formula, and the target that follows. */
function RealBurnCard({ burn, data, today, onSetTarget }: { burn: RealBurn; data: AppData; today: string; onSetTarget: (kcal: number) => void }) {
  const [pace, setPace] = useState(0.5);
  const [done, setDone] = useState(false);
  if (!burn.ok) {
    return (
      <div className="space-y-2 text-sm">
        <p>Your real burn compares what you eat with how your weight actually moves, so it can show whether Fitbit’s calorie burn is right for you.</p>
        <p className="f-muted">To unlock it, it needs {burn.need}.</p>
      </div>
    );
  }
  const floor = kcalFloor(data, today);
  const t = targetFor(burn.real, pace, floor);
  const current = findTracker(data, 'intake')?.goal;
  const est = burn.gap != null ? burn.real + burn.gap : null;
  return (
    <div className="space-y-4">
      <div>
        <p className="f-muted text-xs font-semibold uppercase tracking-[0.14em]">Your real burn</p>
        <p className="fit-display mt-1 text-[2.8rem] tabular-nums">{k(burn.real)} <span className="text-xl">kcal/day</span></p>
        <p className="f-muted text-sm">From {burn.loggedDays} fully logged days (avg {k(burn.avgIntake)} kcal) and your trend ({signed(burn.ratePerWeek, 'kg')}/week, {burn.weighIns} weigh-ins), last 4 weeks.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {burn.fitbit && <div className="rounded-2xl bg-[var(--f-tint)] p-3"><p className="f-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Fitbit says</p><p className="text-lg font-bold tabular-nums">{k(burn.fitbit.avg)}</p><p className="f-muted text-xs">{burn.fitbit.days} days · {signed(burn.fitbit.avg - burn.real, 'kcal')} vs real</p></div>}
        {burn.formula && <div className="rounded-2xl bg-[var(--f-tint)] p-3"><p className="f-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Formula says</p><p className="text-lg font-bold tabular-nums">{k(burn.formula.avg)}</p><p className="f-muted text-xs">{burn.formula.days} days · {signed(burn.formula.avg - burn.real, 'kcal')} vs real</p></div>}
      </div>
      {burn.gap != null && Math.abs(burn.gap) >= 100 && est != null && (
        <Banner tone={burn.gap > 0 ? 'warn' : 'good'} icon={burn.gap > 0 ? AlertTriangle : TrendingDown}>
          {burn.gap > 0
            ? <>The estimates are <strong>{k(burn.gap)} kcal a day higher</strong> than your results show. Either the tracker overestimates your burn, or some food goes unlogged (cooking oil, bites, drinks). Both have the same fix: plan meals around your real burn, not Fitbit’s.</>
            : <>You’re losing faster than the estimates predict: your body burns about <strong>{k(-burn.gap)} kcal a day more</strong> than they say.</>}
        </Banner>
      )}
      <div className="space-y-2 rounded-2xl border border-[var(--f-line)] p-3">
        <p className="text-sm font-semibold">Daily target from your real burn</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekly loss">
          {[0.25, 0.5, 0.75, 1].map(p => <button key={p} type="button" className="f-chip !min-h-9" data-on={pace === p} aria-pressed={pace === p} onClick={() => { setPace(p); setDone(false); }}>{p} kg/week</button>)}
        </div>
        <p className="text-sm">Eat about <strong className="text-base">{k(t.kcal)} kcal</strong> a day{current ? <span className="f-muted"> (now {k(current)})</span> : null}.{t.floored ? <span className="f-muted"> Kept at your safe minimum of {k(floor)}; pick a slower pace.</span> : null}</p>
        <button type="button" className="f-pill f-pill-primary w-full" disabled={done || current === t.kcal} onClick={() => { onSetTarget(t.kcal); setDone(true); }}>
          <Target className="h-4 w-4" aria-hidden />{done || current === t.kcal ? 'This is your target ✓' : `Use ${k(t.kcal)} kcal as my target`}
        </button>
      </div>
    </div>
  );
}

/** Last week, scored out of 10, with one focus. */
function CheckinCard({ data, today }: { data: AppData; today: string }) {
  const c = useMemo(() => weeklyCheckin(data, today), [data, today]);
  if (!c) return <p className="f-muted text-sm">Log a few days of food, steps or sleep to get your weekly check-in.</p>;
  const tone = c.score >= 8 ? 'f-good' : c.score >= 5 ? '' : 'f-bad';
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="f-muted text-xs font-semibold uppercase tracking-[0.14em]">Week of {short(c.from)} – {short(c.to)}</p>
          <p className={`fit-display mt-1 text-[3rem] tabular-nums ${tone}`}>{c.score}<span className="f-muted text-xl">/10</span></p>
        </div>
        {c.trendChange != null && <p className="text-right"><span className={`text-lg font-bold tabular-nums ${c.trendChange < 0 ? 'f-good' : c.trendChange > 0 ? 'f-bad' : ''}`}>{signed(c.trendChange, 'kg')}</span><span className="f-muted block text-xs">trend this week</span></p>}
      </div>
      <ul className="f-card overflow-hidden">
        {c.areas.map(a => (
          <li key={a.id} className="f-row">
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{a.label}</span><span className="f-muted block text-xs">{a.detail}</span></span>
            <span className="flex gap-1" aria-label={`${a.points} of 2`}>{[0, 1].map(i => <span key={i} className="h-2.5 w-5 rounded-full" style={{ background: i < a.points ? 'var(--f-deep)' : 'var(--f-line)' }} />)}</span>
          </li>
        ))}
      </ul>
      <div className="f-muted grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {c.avg.kcal != null && <span>Avg <strong className="text-[var(--f-ink)]">{k(c.avg.kcal)}</strong> kcal</span>}
        {c.avg.protein != null && <span>Avg <strong className="text-[var(--f-ink)]">{k(c.avg.protein)}</strong> g protein</span>}
        {c.avg.steps != null && <span>Avg <strong className="text-[var(--f-ink)]">{k(c.avg.steps)}</strong> steps</span>}
        {c.avg.sleepH != null && <span>Avg <strong className="text-[var(--f-ink)]">{fmtSleep(c.avg.sleepH)}</strong> sleep</span>}
      </div>
      {c.focus ? <Banner tone="warn" icon={Target}><strong>This week’s focus: {c.areas.find(a => a.id === c.focus!.area)?.label.toLowerCase()}.</strong> {c.focus.text}</Banner>
        : <Banner tone="good" icon={PartyPopper}><strong>Every habit on track.</strong> Keep the same rhythm this week.</Banner>}
    </div>
  );
}

/** Progress: the motivation and analysis cards in one place, one tab at a time. */
export function ProgressHub({ data, today, onDataChange, showcase }: {
  data: AppData; today: string; onDataChange: (d: AppData) => void; showcase?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('journey');
  useEffect(() => {
    // Sunday and Monday open on the check-in; otherwise the tab you used last.
    const dow = new Date(`${today}T00:00:00`).getDay();
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* not remembered */ }
    setTab(dow === 0 || dow === 1 ? 'checkin' : TABS.some(t => t.id === saved) ? (saved as Tab) : 'journey');
  }, [today]);
  const choose = (t: Tab) => { setTab(t); try { localStorage.setItem(KEY, t); } catch { /* not remembered */ } };
  const j = useMemo(() => journey(data, today), [data, today]);
  const burn = useMemo(() => realBurn(data, today), [data, today]);
  const setTarget = (kcal: number) => {
    const t = findTracker(data, 'intake');
    onDataChange(t ? { ...data, logTrackers: data.logTrackers.map(x => (x.id === t.id ? { ...x, goal: kcal } : x)) }
      : { ...data, logTrackers: [...data.logTrackers, { id: `intake-${Date.now()}`, name: 'Daily Calorie Intake', unit: 'kcal', goal: kcal, logs: [] }] });
  };

  return (
    <section className="f-card p-5" aria-label="Progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="fit-display text-2xl">Your <em>progress</em></h2>
      </div>
      <div className="f-scroll-x -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Progress views">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="f-chip shrink-0" data-on={tab === id} onClick={() => choose(id)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />{label}
          </button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel" aria-label={TABS.find(t => t.id === tab)?.label}>
        {tab === 'journey' && <JourneyCard j={j} burn={burn} data={data} today={today} />}
        {tab === 'burn' && <RealBurnCard burn={burn} data={data} today={today} onSetTarget={setTarget} />}
        {tab === 'checkin' && <CheckinCard data={data} today={today} />}
        {tab === 'insights' && <InsightsCard data={data} today={today} burn={burn} trendKg={j?.current.kg} />}
      </div>
      <Link href={showcase ? '/showcase/profile' : '/profile'} className="f-muted mt-4 inline-flex items-center gap-1.5 text-sm underline underline-offset-2">
        <Ruler className="h-3.5 w-3.5" aria-hidden />Measurements and progress photos are on your Profile
      </Link>
    </section>
  );
}
