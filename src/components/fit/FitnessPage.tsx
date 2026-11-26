import './fit.css';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Activity, AppData, Meal } from '@/lib/types';
import { applyDraft, clearBurnBase, dayBurn, dayIntake, editDayItem, findTracker, loggingStreak, stepsStreak, valueOn, type FitnessDraft } from '@/lib/fitness';
import { fitSerif } from './font';
import { Hero } from './Hero';
import { Ring } from './Ring';
import { FitbitChip } from './FitbitChip';
import { WeightCard } from './WeightCard';
import { WeekCards } from './WeekCards';
import { DayLog, type AddTarget } from './DayLog';
import { TrackerTiles } from './TrackerTiles';
import { TrackerSheet } from './TrackerSheet';
import { LogSheet } from './LogSheet';
import { TargetsSheet } from './TargetsSheet';
import { ManageSheet } from './ManageSheet';
import { LookPicker, useFitLook } from './Looks';
import { AiSummary } from './AiSummary';
import { ItemSheet, type ItemRef } from './ItemSheet';

const EXAMPLES = ['94.1 kg, 12k steps, 110g protein', 'Had 2 rotis and dal, walked 40 min', 'Snap your lunch, I’ll count it', 'Ran 5k in 32 min'];
const k = (n: number) => Math.round(n).toLocaleString('en-US');

/** The typed hero line: what was logged on the day, else example prompts. */
function heroLines(data: AppData, day: string): string[] {
  const fd = data.fitnessDays?.[day];
  const lines: string[] = [];
  const meals = (fd?.meals ?? []).filter(m => m.name !== 'Earlier total' && m.name !== 'Day total');
  const clip = (s: string) => (s.length > 22 ? `${s.slice(0, 21).trimEnd()}…` : s);
  if (meals.length) lines.push(`Had ${meals.slice(0, 2).map(m => clip(m.name)).join(' and ')}${meals.length > 2 ? ` +${meals.length - 2} more` : ''} · ${k(meals.reduce((s, m) => s + m.kcal, 0))} kcal`);
  for (const a of (fd?.activities ?? []).slice(0, 2)) lines.push(`${a.name}, ${Math.round(a.minutes)} min · ${k(a.kcal)} kcal`);
  return lines.length ? [...lines, EXAMPLES[0]] : EXAMPLES;
}

export function FitnessPage({ data, onDataChange, showcase = false }: { data: AppData; onDataChange: (d: AppData) => void; showcase?: boolean }) {
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [day, setDay] = useState(today);
  // A Home Screen app can stay open overnight: roll "today" over, and move the
  // selected day with it if it was on today, so breakfast isn't logged to yesterday.
  useEffect(() => {
    const tick = () => {
      const now = format(new Date(), 'yyyy-MM-dd');
      setToday(prev => {
        if (prev !== now) setDay(d => (d === prev ? now : d));
        return now;
      });
    };
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const [log, setLog] = useState<{ open: boolean; mode: 'type' | 'voice' | 'photo' | 'form'; preset?: AddTarget }>({ open: false, mode: 'type' });
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [openTracker, setOpenTracker] = useState<string | null>(null);
  const [look, setLook] = useFitLook();
  const [item, setItem] = useState<ItemRef | null>(null);

  const s = useMemo(() => {
    const intake = dayIntake(data, day);
    const burn = dayBurn(data, day);
    return {
      intake, burn,
      steps: valueOn(findTracker(data, 'steps'), day),
      stepsGoal: findTracker(data, 'steps')?.goal,
      proteinGoal: findTracker(data, 'protein')?.goal,
      kcalGoal: findTracker(data, 'intake')?.goal,
      sleep: valueOn(findTracker(data, 'sleep'), day),
      rhr: valueOn(findTracker(data, 'restingHr'), day),
      net: intake.kcal != null && burn.total != null ? intake.kcal - burn.total : null,
      streak: loggingStreak(data, today),
      stepStreak: stepsStreak(data, today),
      lines: heroLines(data, day),
    };
  }, [data, day, today]);

  const openLog = (mode: 'type' | 'voice' | 'photo') => setLog({ open: true, mode });
  const save = (draft: FitnessDraft) => onDataChange(applyDraft(data, draft, uuidv4));
  const edit = (kind: 'meal' | 'activity', id: string, patch: Partial<Meal & Activity> | null) => onDataChange(editDayItem(data, day, kind, id, patch, uuidv4));
  const tracker = data.logTrackers.find(t => t.id === openTracker) ?? null;
  const needsSetup = !data.fitnessProfile;

  return (
    <div className={cn('fit-ui min-h-full', fitSerif.variable)}>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-28 md:p-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="min-w-0 space-y-4">
            <Hero day={day} today={today} onDay={setDay} streak={s.streak} stepStreak={s.stepStreak} stepGoal={s.stepsGoal || 10000} netKcal={s.net} sleepH={s.sleep} rhr={s.rhr}
              fitbit={showcase ? undefined : <FitbitChip />} lines={s.lines}
              onType={() => openLog('type')} onVoice={() => openLog('voice')} onPhoto={() => openLog('photo')}
              rings={<>
                <Ring label="Steps" unit="steps" value={s.steps} target={s.stepsGoal} onSetTarget={() => setTargetsOpen(true)} />
                <Ring label="Protein" unit="g" value={s.intake.proteinG} target={s.proteinGoal} color="var(--f-chart-a)" onSetTarget={() => setTargetsOpen(true)} />
                <Ring label="Calories" unit="kcal" value={s.intake.kcal} target={s.kcalGoal} over="bad" color="var(--f-chart-b)" onSetTarget={() => setTargetsOpen(true)} />
              </>} />
            {needsSetup && (
              <button type="button" onClick={() => setTargetsOpen(true)} className="f-card flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--f-tint)]"><UserRound className="h-5 w-5 text-[var(--f-deep)]" aria-hidden /></span>
                <span>
                  <span className="block font-semibold">Set up your profile</span>
                  <span className="f-muted block text-sm">Age and height turn on your daily burn and net calories.</span>
                </span>
              </button>
            )}
            <DayLog data={data} day={day} kcalGoal={s.kcalGoal} onEdit={edit} onClearBurn={() => onDataChange(clearBurnBase(data, day, uuidv4))}
              onOpen={setItem} onAdd={preset => setLog({ open: true, mode: 'form', preset })} />
          </div>
          <div className="space-y-4">
            <WeightCard data={data} today={today} onSetGoal={() => setTargetsOpen(true)} />
            <WeekCards data={data} day={day} />
          </div>
        </div>

        <TrackerTiles data={data} today={day} onOpen={setOpenTracker} onManage={() => setManageOpen(true)} />
        <AiSummary data={data} today={today} aiDisabled={showcase} />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <button type="button" className="f-chip" onClick={() => setTargetsOpen(true)}><UserRound className="h-3.5 w-3.5" aria-hidden />Targets &amp; profile</button>
          <LookPicker look={look} onLook={setLook} />
        </div>
      </div>

      <LogSheet open={log.open} onOpenChange={o => setLog(l => ({ ...l, open: o }))} mode={log.mode} preset={log.preset} data={data} day={day} today={today} onSave={save} aiDisabled={showcase} />
      <ItemSheet item={item} data={data} day={day} today={today} aiDisabled={showcase} onClose={() => setItem(null)}
        onSave={(it, patch) => onDataChange(editDayItem(data, day, it.kind, it.id, patch, uuidv4))}
        onDelete={it => onDataChange(editDayItem(data, day, it.kind, it.id, null, uuidv4))}
        onReplace={(it, draft) => onDataChange(applyDraft(editDayItem(data, day, it.kind, it.id, null, uuidv4), draft, uuidv4))} />
      <TargetsSheet open={targetsOpen} onOpenChange={setTargetsOpen} data={data} today={today} onSave={onDataChange} />
      <ManageSheet open={manageOpen} onOpenChange={setManageOpen} data={data} onDataChange={onDataChange} showcase={showcase} />
      <TrackerSheet tracker={tracker} onClose={() => setOpenTracker(null)}
        onChange={p => onDataChange({ ...data, logTrackers: data.logTrackers.map(t => (t.id === openTracker ? { ...t, ...p } : t)) })}
        onDelete={() => { onDataChange({ ...data, logTrackers: data.logTrackers.filter(t => t.id !== openTracker) }); setOpenTracker(null); }} />
    </div>
  );
}
