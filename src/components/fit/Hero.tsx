import { useEffect, useRef, useState } from 'react';
import { AudioLines, CalendarDays, Camera, Flame, Footprints, HeartPulse, Pencil } from 'lucide-react';
import { addDays } from '@/lib/fitness';

/** "Had *2* rotis": numbers get the italic accent (from FinWise split's hero). */
function Accent({ text }: { text: string }) {
  const parts = text.split(/(\d[\d,.]*k?)/);
  return <>{parts.map((p, i) => (/^\d/.test(p) ? <em key={i} className="text-[var(--f-ink)]">{p}</em> : <span key={i}>{p}</span>))}</>;
}

/** Types each line out, holds it, moves on. Static for reduced-motion users. */
function useTyped(lines: string[]) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const key = lines.join('|');
  useEffect(() => { setI(0); setN(0); }, [key]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(Infinity); return; }
    const line = lines[i % lines.length] ?? '';
    const t = n < line.length ? setTimeout(() => setN(n + 1), 38) : setTimeout(() => { setI(i + 1); setN(0); }, 2600);
    return () => clearTimeout(t);
  }, [i, n, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const line = lines[i % lines.length] ?? '';
  return { text: line.slice(0, n), done: n >= line.length };
}

const daysAgo = (day: string, today: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400_000);
const chipLabel = (day: string, today: string) => {
  const ago = daysAgo(day, today);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', ago < 7 ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' });
};

/** Today, Yesterday, then earlier days in a sideways strip that keeps going back as you scroll; Pick day for anything else. */
function DayStrip({ day, today, onDay }: { day: string; today: string; onDay: (d: string) => void }) {
  const [count, setCount] = useState(14);
  const shown = Math.max(count, daysAgo(day, today) + 1); // a picked day further back is added to the strip
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [day]);
  const onScroll = () => {
    const el = strip.current;
    if (el && el.scrollLeft + el.clientWidth > el.scrollWidth - 120) setCount(c => c + 14);
  };
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div ref={strip} onScroll={onScroll} className="f-scroll-x flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="group" aria-label="Choose a day">
        {Array.from({ length: shown }, (_, i) => addDays(today, -i)).map(d => (
          <button key={d} type="button" className="f-chip shrink-0" data-on={d === day} aria-pressed={d === day} onClick={() => onDay(d)}>{chipLabel(d, today)}</button>
        ))}
      </div>
      <label className="f-chip relative shrink-0 cursor-pointer" title="Pick a day">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />Pick
        <input type="date" className="absolute inset-0 cursor-pointer opacity-0" max={today} value={day}
          aria-label="Pick a day to view or log" onChange={e => e.target.value && onDay(e.target.value)} />
      </label>
    </div>
  );
}

const dayLabel = (day: string, today: string) => {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export function Hero({ day, today, onDay, rings, netKcal, netReal, burnLabel = 'Fitbit', rhr, streak, stepStreak, stepGoal, fitbit, lines, onType, onVoice, onPhoto }: {
  day: string; today: string; onDay: (ymd: string) => void; rings: React.ReactNode;
  netKcal: number | null; /** Net against your real burn (Progress → Real burn); null until there's enough data. */ netReal?: number | null; burnLabel?: string; rhr?: number; streak: number; stepStreak: number; stepGoal: number; fitbit?: React.ReactNode;
  lines: string[]; onType: () => void; onVoice: () => void; onPhoto: () => void;
}) {
  const { text, done } = useTyped(lines);
  return (
    <section className="f-hero flex min-w-0 flex-col gap-4 p-5" aria-label="Today at a glance">
      <div className="flex flex-col gap-2">
        <DayStrip day={day} today={today} onDay={onDay} />
        <div className="flex flex-wrap items-center gap-2">
          {streak > 0 && (
            <span className="f-chip" title="Days in a row you logged something yourself (meals, workouts, weight…)" aria-label={`Logging streak: ${streak} days`}>
              <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />{streak}d logged
            </span>
          )}
          {stepStreak > 0 && (
            <span className="f-chip" title={`Days in a row with ${stepGoal.toLocaleString('en-US')}+ steps`} aria-label={`Steps streak: ${stepStreak} days at ${stepGoal.toLocaleString('en-US')} steps or more`}>
              <Footprints className="h-3.5 w-3.5 text-[var(--f-accent)]" aria-hidden />{stepStreak}d {stepGoal >= 1000 ? `${Math.round(stepGoal / 100) / 10}k` : stepGoal}+ steps
            </span>
          )}
          {fitbit}
        </div>
      </div>

      <h1 className="fit-display text-[1.9rem]">{dayLabel(day, today)}<span className="sr-only">: rings and totals</span></h1>

      {rings}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {(() => {
          // "Fitbit / real": net against the tracker's burn, then against your real burn when it's known.
          const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
          const tone = (n: number) => (n < 0 ? 'f-good' : n > 0 ? 'f-bad' : '');
          const word = (n: number) => (n < 0 ? 'deficit' : n > 0 ? 'surplus' : 'even');
          if (netKcal == null) return <span>Net <strong>—</strong></span>;
          const last = netReal ?? netKcal;
          return (
            <span className="inline-flex flex-col items-center leading-tight"
              aria-label={`Net ${sign(netKcal)} kcal with ${burnLabel} burn${netReal != null ? `, ${sign(netReal)} kcal with your real burn` : ''}`}>
              <span aria-hidden>
                Net <strong className={tone(netKcal)}>{sign(netKcal)}</strong>
                {netReal != null && <> <span className="f-muted">/</span> <strong className={tone(netReal)}>{sign(netReal)}</strong></>}
                <span className={`font-semibold ${tone(last)}`}> kcal {word(last)}</span>
              </span>
              {netReal != null && <span className="f-muted text-[10px] font-semibold uppercase tracking-[0.12em]" aria-hidden>{burnLabel} / real burn</span>}
            </span>
          );
        })()}
        {rhr != null && (
          <span className="inline-flex items-center gap-1"><HeartPulse className="h-3.5 w-3.5 text-[var(--f-coral)]" aria-hidden />
            RHR <strong>{Math.round(rhr)}</strong></span>
        )}
      </div>

      <button type="button" onClick={onType} aria-label="Type what you ate or did and let AI log it" className="py-2 text-left">
        <p className="fit-display min-h-[2.3em] text-[1.85rem] leading-[1.12] text-[color-mix(in_srgb,var(--f-ink)_70%,transparent)]" aria-hidden>
          <Accent text={text} />
          <span className={`ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] bg-[var(--f-deep)] ${done ? 'motion-safe:animate-pulse' : ''}`} />
        </p>
        <span className="sr-only">{lines[0]}</span>
      </button>

      <div className="flex items-end justify-between">
        <button type="button" className="f-icon-btn h-14 w-14 rounded-[18px]" aria-label="Log a meal or workout from a photo" onClick={onPhoto}>
          <Camera className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <button type="button" className="f-icon-btn h-14 w-14 rounded-[18px]" aria-label="Type a meal, workout or value" onClick={onType}>
            <Pencil className="h-5 w-5" />
          </button>
          <button type="button" className="f-voice-btn h-16 w-16" aria-label="Say what you ate or did" onClick={onVoice}>
            <AudioLines className="h-7 w-7" />
          </button>
        </div>
      </div>
    </section>
  );
}
