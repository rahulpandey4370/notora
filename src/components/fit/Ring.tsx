import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

const num = (n: number) => Math.round(n).toLocaleString('en-US');

/** Hours → "7h 17m" from whole minutes (no 6-minute steps, never "7h 60m"). */
export const fmtSleep = (h: number) => {
  const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
  return hh ? `${hh}h${mm ? ` ${mm}m` : ''}` : `${mm}m`;
};

/** Counts 0 → `to` (ease-out) each time `run` turns on. Jumps straight there for reduced-motion users. */
function useCountUp(to: number | undefined, run: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to == null) return;
    if (!run) { setN(0); return; }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min((t - t0) / 1000, 1);
      setN(to * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Frames pause in a background tab: land on the real number regardless.
    const land = setTimeout(() => { cancelAnimationFrame(raf); setN(to); }, 1100);
    return () => { cancelAnimationFrame(raf); clearTimeout(land); };
  }, [to, run]);
  return n;
}

export type StatSpec = {
  key: string; label: string; unit: string; icon: LucideIcon; value?: number; target?: number;
  /** Whether going past the target is good (steps, protein) or bad (calories). */
  over?: 'bad' | 'good'; color?: string; format?: (n: number) => string;
  /** Word after the amount still missing: "to go", "left", "short". */
  remaining?: string; empty?: string;
};

/**
 * One hero stat: a ring that fills and a number that counts up whenever the
 * card comes into view (`active`). Missing target → "Set target"; missing value → "—".
 */
export function Ring({ label, unit, icon: Icon, value, target, over = 'good', color = 'var(--f-accent)', format = num,
  remaining = 'to go', empty = 'Nothing logged yet', active, onSetTarget }: Omit<StatSpec, 'key'> & { active: boolean; onSetTarget?: () => void }) {
  const size = 116, stroke = 11, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const shownValue = useCountUp(value, active);
  const pct = value != null && target ? value / target : 0;
  const isOver = value != null && target != null && value > target;
  const ringColor = isOver && over === 'bad' ? 'var(--f-coral)' : color;
  const unitSuffix = unit ? ` ${unit}` : '';
  const status = target == null ? 'Tap to set a target'
    : value == null ? empty
      : value >= target ? (over === 'bad' ? (isOver ? `${format(value - target)}${unitSuffix} over` : 'Right on target') : 'Goal reached')
        : `${format(target - value)}${unitSuffix} ${remaining}`;
  const statusTone = value != null && target != null && value >= target ? (over === 'bad' && isOver ? 'f-bad' : 'f-good') : 'f-muted';
  const aria = target == null ? `${label}: no target set`
    : value == null ? `${label}: ${empty.toLowerCase()}, target ${format(target)}${unitSuffix}`
      : `${label} ${format(value)} of ${format(target)}${unitSuffix}, ${Math.round(pct * 100)}%. ${status}`;

  const ring = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="f-ring-track" />
        {target != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke={ringColor}
            strokeDasharray={c} strokeDashoffset={c * (1 - (active ? Math.min(pct, 1) : 0))} className="f-ring-bar" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {target == null ? <span className="f-muted text-xs font-semibold">Set<br />target</span> : (
          <>
            <span className="text-[1.35rem] font-bold tabular-nums">{value == null ? '—' : `${Math.round(pct * 100)}%`}</span>
            <span className="f-muted mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">of goal</span>
          </>
        )}
      </div>
    </div>
  );

  const body = (
    <div className="f-stat flex items-center gap-5 p-4" data-active={active} style={{ '--c': ringColor } as React.CSSProperties} role="img" aria-label={aria}>
      {ring}
      <div className="f-stat-text min-w-0 flex-1">
        <span className="f-muted inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden />{label}
        </span>
        <p className="fit-display mt-1 truncate text-[2.35rem] tabular-nums">
          {value == null ? '—' : format(shownValue)}
          {value != null && unit && <span className="f-muted ml-1 font-sans text-sm font-semibold">{unit}</span>}
        </p>
        {target != null && <p className="f-muted text-xs tabular-nums">of {format(target)}{unitSuffix}</p>}
        <p className={`mt-2 text-sm font-semibold ${statusTone}`}>{status}</p>
      </div>
    </div>
  );

  return target == null && onSetTarget
    ? <button type="button" onClick={onSetTarget} className="block w-full rounded-[22px] text-left" aria-label={`Set a ${label.toLowerCase()} target`}>{body}</button>
    : body;
}
