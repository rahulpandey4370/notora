const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(n).toLocaleString('en-US'));

/**
 * One activity ring. `over`: whether going past the target is good (steps,
 * protein) or bad (calories). Missing target → "Set target"; missing value → "—".
 */
export function Ring({ value, target, label, unit, over = 'good', color = 'var(--f-accent)', onSetTarget }: {
  value?: number; target?: number; label: string; unit: string; over?: 'bad' | 'good'; color?: string; onSetTarget?: () => void;
}) {
  const size = 92, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = value != null && target ? value / target : 0;
  const isOver = value != null && target != null && value > target;
  const stroke2 = isOver && over === 'bad' ? 'var(--f-coral)' : color;
  const shown = Math.min(pct, 1);
  const aria = target == null
    ? `${label}: no target set`
    : value == null ? `${label}: nothing logged, target ${fmt(target)} ${unit}`
      : `${label} ${fmt(value)} of ${fmt(target)} ${unit}, ${Math.round(pct * 100)}%${isOver ? (over === 'bad' ? ', over target' : ', target reached') : ''}`;

  const body = (
    <div className="flex flex-col items-center gap-1.5" role="img" aria-label={aria}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="f-ring-track" />
          {target != null && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
              stroke={stroke2} strokeDasharray={c} strokeDashoffset={c * (1 - shown)} className="f-ring-bar" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          {target == null ? (
            <span className="f-muted text-[11px] font-semibold">Set<br />target</span>
          ) : (
            <>
              <span className="text-[1.05rem] font-bold tabular-nums">{value == null ? '—' : fmt(value)}</span>
              <span className="f-muted mt-0.5 text-[10px] tabular-nums">/ {fmt(target)}</span>
            </>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold">
        {label}
        {isOver && <span className={over === 'bad' ? 'f-bad' : 'f-good'}> {over === 'bad' ? '▲ over' : '✓'}</span>}
      </span>
    </div>
  );

  return target == null && onSetTarget
    ? <button type="button" onClick={onSetTarget} className="rounded-2xl" aria-label={`Set a ${label.toLowerCase()} target`}>{body}</button>
    : body;
}
