import { useEffect, useState } from 'react';
import { AudioLines, Camera, Flame, Moon, HeartPulse, Pencil } from 'lucide-react';
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

const dayLabel = (day: string, today: string) => {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export function Hero({ day, today, onDay, rings, netKcal, sleepH, rhr, streak, fitbit, lines, onType, onVoice, onPhoto }: {
  day: string; today: string; onDay: (ymd: string) => void; rings: React.ReactNode;
  netKcal: number | null; sleepH?: number; rhr?: number; streak: number; fitbit?: React.ReactNode;
  lines: string[]; onType: () => void; onVoice: () => void; onPhoto: () => void;
}) {
  const { text, done } = useTyped(lines);
  const isPast = day !== today;
  return (
    <section className="f-hero flex flex-col gap-4 p-5" aria-label="Today at a glance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className="f-chip" data-on={!isPast} aria-pressed={!isPast} onClick={() => onDay(today)}>Today</button>
          <button type="button" className="f-chip" data-on={day === addDays(today, -1)} aria-pressed={day === addDays(today, -1)} onClick={() => onDay(addDays(today, -1))}>Yesterday</button>
          <label className="f-chip relative cursor-pointer" data-on={isPast && day !== addDays(today, -1)}>
            {isPast && day !== addDays(today, -1) ? dayLabel(day, today) : 'Pick day'}
            <input type="date" className="absolute inset-0 cursor-pointer opacity-0" max={today} value={day}
              aria-label="Pick a day to view or log" onChange={e => e.target.value && onDay(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="f-chip" title="Days in a row with something logged">
              <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />{streak}-day streak
            </span>
          )}
          {fitbit}
        </div>
      </div>

      <h1 className="fit-display text-[1.9rem]">{dayLabel(day, today)}<span className="sr-only">: rings and totals</span></h1>

      <div className="grid grid-cols-3 justify-items-center gap-2">{rings}</div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <span>
          Net{' '}
          {netKcal == null ? <strong>—</strong> : (
            <strong className={netKcal < 0 ? 'f-good' : netKcal > 0 ? 'f-bad' : ''}>
              {netKcal > 0 ? '+' : netKcal < 0 ? '−' : ''}{Math.abs(Math.round(netKcal)).toLocaleString('en-US')} kcal
              <span className="font-normal"> {netKcal < 0 ? 'deficit' : netKcal > 0 ? 'surplus' : 'even'}</span>
            </strong>
          )}
        </span>
        {sleepH != null && (
          <span className="inline-flex items-center gap-1"><Moon className="h-3.5 w-3.5 text-[var(--f-sleep)]" aria-hidden />
            Slept <strong>{Math.floor(sleepH)}h {Math.round((sleepH % 1) * 60)}m</strong></span>
        )}
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
