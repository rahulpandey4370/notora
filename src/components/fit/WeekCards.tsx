import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData } from '@/lib/types';
import { addDays, dayBurn, dayIntake, findTracker, valueOn } from '@/lib/fitness';

const tip = { background: 'var(--f-card)', border: '1px solid var(--f-line)', borderRadius: 12, color: 'var(--f-ink)' };
const dow = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
const avg = (xs: (number | undefined | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const kTick = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

function Card({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <section className="f-card p-4" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="f-muted text-xs">{summary}</p>
      <div className="mt-3 h-36" aria-hidden>{children}</div>
    </section>
  );
}

/** The 7 days ending on `day`: calories in vs burned, steps, sleep. */
export function WeekCards({ data, day }: { data: AppData; day: string }) {
  const rows = useMemo(() => {
    const stepsT = findTracker(data, 'steps'), sleepT = findTracker(data, 'sleep');
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(day, i - 6);
      const intake = dayIntake(data, d).kcal;
      const burn = dayBurn(data, d).total;
      return {
        date: d, label: dow(d), intake, burn: burn == null ? undefined : Math.round(burn),
        net: intake != null && burn != null ? Math.round(intake - burn) : undefined,
        steps: valueOn(stepsT, d), sleep: valueOn(sleepT, d),
      };
    });
  }, [data, day]);

  const stepsGoal = findTracker(data, 'steps')?.goal;
  const sleepGoal = findTracker(data, 'sleep')?.goal;
  const avgNet = avg(rows.map(r => r.net));
  const avgSteps = avg(rows.map(r => r.steps));
  const avgSleep = avg(rows.map(r => r.sleep));
  const hasSleep = rows.some(r => r.sleep != null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Card title="Calories in vs burned"
          summary={avgNet == null ? 'Log meals to see your balance.' : `Avg net ${avgNet > 0 ? '+' : '−'}${n0(Math.abs(avgNet))} kcal/day ${avgNet < 0 ? '(deficit)' : '(surplus)'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--f-line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={kTick} />
              <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }}
                labelFormatter={(_l, p) => (p?.[0]?.payload?.net != null ? `Net ${p[0].payload.net > 0 ? '+' : ''}${n0(p[0].payload.net)} kcal` : '')}
                formatter={(v: number, name: string) => [`${n0(v)} kcal`, name === 'intake' ? 'In' : 'Burned']} />
              <Bar dataKey="intake" fill="var(--f-chart-a)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="burn" fill="var(--f-chart-b)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <div className="f-muted -mt-2 flex gap-4 px-4 pb-1 text-xs">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--f-chart-a)]" />In</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--f-chart-b)]" />Burned</span>
        </div>
      </div>

      <Card title="Steps" summary={avgSteps == null ? 'No steps this week.' : `Avg ${n0(avgSteps)}/day${stepsGoal ? ` · goal ${n0(stepsGoal)}` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={kTick} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }} formatter={(v: number) => [n0(v), 'Steps']} />
            {stepsGoal && <ReferenceLine y={stepsGoal} stroke="var(--f-good)" strokeDasharray="4 4" />}
            <Bar dataKey="steps" fill="var(--f-accent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Sleep" summary={!hasSleep ? 'Connect Fitbit to see sleep.' : `Avg ${avgSleep!.toFixed(1)} h/night`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 'dataMax + 1']} allowDecimals={false} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'var(--f-tint)' }} formatter={(v: number) => [`${Math.floor(v)}h ${Math.round((v % 1) * 60)}m`, 'Sleep']} />
            <ReferenceLine y={sleepGoal ?? 8} stroke="var(--f-good)" strokeDasharray="4 4" />
            <Bar dataKey="sleep" fill="var(--f-sleep)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
