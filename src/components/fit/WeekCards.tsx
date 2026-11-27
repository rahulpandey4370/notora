import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData } from '@/lib/types';
import { addDays, dayBurn, dayIntake, findTracker, valueOn } from '@/lib/fitness';
import { fmtSleep } from './Ring';

const tip = { background: 'var(--f-card)', border: '1px solid var(--f-line)', borderRadius: 12, color: 'var(--f-ink)' };
const dow = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
const avg = (xs: (number | undefined | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const kTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

function Card({ title, summary, legend, children }: { title: string; summary: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="f-card min-w-0 overflow-hidden p-4" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="f-muted text-xs">{summary}</p>
      <div className="mt-3 h-36" aria-hidden>{children}</div>
      {legend && <div className="f-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{legend}</div>}
    </section>
  );
}

/** The 7 days ending on `day`: calories in vs burned, steps, sleep. */
/** realScale: your real burn ÷ the estimates (lib/real-burn); null shows the tracker's burn alone. */
export function WeekCards({ data, day, realScale = null }: { data: AppData; day: string; realScale?: number | null }) {
  const rows = useMemo(() => {
    const stepsT = findTracker(data, 'steps'), sleepT = findTracker(data, 'sleep');
    const at = (d: string) => {
      const burn = dayBurn(data, d).total;
      return { intake: dayIntake(data, d).kcal, burn: burn == null ? undefined : Math.round(burn), steps: valueOn(stepsT, d), sleep: valueOn(sleepT, d) };
    };
    // 13 days so each of the 7 shown days gets the average of the week ending on it (the trend line).
    const days = Array.from({ length: 13 }, (_, i) => ({ d: addDays(day, i - 12), ...at(addDays(day, i - 12)) }));
    const roll = (i: number, k: 'intake' | 'burn' | 'steps' | 'sleep', dp = 0) => {
      const a = avg(days.slice(i, i + 7).map(x => x[k]));
      return a == null ? undefined : Math.round(a * 10 ** dp) / 10 ** dp;
    };
    return days.slice(6).map((x, i) => ({
      date: x.d, label: dow(x.d), intake: x.intake, burn: x.burn, steps: x.steps, sleep: x.sleep,
      net: x.intake != null && x.burn != null ? Math.round(x.intake - x.burn) : undefined,
      real: realScale != null && x.burn != null ? Math.round(x.burn * realScale) : undefined,
      netReal: realScale != null && x.intake != null && x.burn != null ? Math.round(x.intake - x.burn * realScale) : undefined,
      intakeAvg: roll(i, 'intake'), burnAvg: roll(i, 'burn'), stepsAvg: roll(i, 'steps'), sleepAvg: roll(i, 'sleep', 1),
    }));
  }, [data, day, realScale]);

  const stepsGoal = findTracker(data, 'steps')?.goal;
  const sleepGoal = findTracker(data, 'sleep')?.goal;
  const avgNet = avg(rows.map(r => r.net));
  const avgNetReal = avg(rows.map(r => r.netReal));
  const signed = (n: number) => `${n > 0 ? '+' : '−'}${n0(Math.abs(n))}`;
  const avgSteps = avg(rows.map(r => r.steps));
  const avgSleep = avg(rows.map(r => r.sleep));
  const hasSleep = rows.some(r => r.sleep != null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Card title="Calories in vs burned"
          legend={<>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--f-chart-a)]" />In</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--f-chart-b)]" />Burned</span>
            {realScale != null && <span className="inline-flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-[var(--f-deep)]" />Real burn</span>}
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-[var(--f-sec)]" />7-day average</span>
          </>}
          summary={avgNet == null ? 'Log meals to see your balance.'
            : avgNetReal != null ? `Avg net ${signed(avgNet)} / ${signed(avgNetReal)} kcal/day ${avgNetReal < 0 ? 'deficit' : 'surplus'} (tracker / real burn)`
              : `Avg net ${signed(avgNet)} kcal/day ${avgNet < 0 ? '(deficit)' : '(surplus)'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--f-line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={kTick} />
              <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }}
                labelFormatter={(_l, p) => { const r = p?.[0]?.payload; return r?.net != null ? `Net ${signed(r.net)}${r.netReal != null ? ` / ${signed(r.netReal)}` : ''} kcal` : ''; }}
                formatter={(v: number, name: string, item: { payload?: { real?: number } }) => [
                  name === 'burn' && item?.payload?.real != null ? `${n0(v)} / ${n0(item.payload.real)} real` : `${n0(v)} kcal`,
                  ({ intake: 'In', burn: 'Burned', real: 'Real burn', intakeAvg: 'In, 7-day avg', burnAvg: 'Burned, 7-day avg' } as Record<string, string>)[name] ?? name]} />
              <Bar dataKey="intake" fill="var(--f-chart-a)" fillOpacity={0.55} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="burn" fill="var(--f-chart-b)" fillOpacity={0.55} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Line dataKey="intakeAvg" type="monotone" stroke="var(--f-chart-a)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              <Line dataKey="burnAvg" type="monotone" stroke="var(--f-chart-b)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              {realScale != null && <Line dataKey="real" type="monotone" stroke="var(--f-deep)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: 'var(--f-deep)' }} connectNulls isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Steps" legend={<span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-[var(--f-deep)]" />7-day average</span>} summary={avgSteps == null ? 'No steps this week.' : `Avg ${n0(avgSteps)}/day${stepsGoal ? ` · goal ${n0(stepsGoal)}` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={kTick} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }} formatter={(v: number, name: string) => [n0(v), name === 'stepsAvg' ? '7-day avg' : 'Steps']} />
            {stepsGoal && <ReferenceLine y={stepsGoal} stroke="var(--f-good)" strokeDasharray="4 4" />}
            <Bar dataKey="steps" fill="var(--f-accent)" fillOpacity={0.55} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Line dataKey="stepsAvg" type="monotone" stroke="var(--f-deep)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Sleep" legend={<span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-[var(--f-sleep)]" />7-day average</span>} summary={!hasSleep ? 'Connect Fitbit to see sleep.' : `Avg ${avgSleep!.toFixed(1)} h/night`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'dataMax + 1']} allowDecimals={false} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }} formatter={(v: number, name: string) => [fmtSleep(v), name === 'sleepAvg' ? '7-day avg' : 'Sleep']} />
            <ReferenceLine y={sleepGoal ?? 8} stroke="var(--f-good)" strokeDasharray="4 4" />
            <Bar dataKey="sleep" fill="var(--f-sleep)" fillOpacity={0.55} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Line dataKey="sleepAvg" type="monotone" stroke="var(--f-sleep)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
