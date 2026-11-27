import './fit.css';
import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Bell, KeyRound, Loader2, LogOut, Palette, Ruler, UserRound, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppData, User } from '@/lib/types';
import { MEAL_SLOTS, findTracker, slotForTime, weightOn } from '@/lib/fitness';
import { SCHEDULE } from '@/lib/reminders';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { fitSerif } from './font';
import { TargetsForm } from './TargetsSheet';
import { BodyCard } from './BodyCard';
import { LookPicker, useFitLook } from './Looks';
import { FoodsPanel } from './FoodsPanel';
import { useFoods } from './useFoods';
import { TrackerSheet } from './TrackerSheet';

const REMINDER_LABEL: Record<string, string> = {
  breakfast: 'Breakfast + weigh-in', morningSnack: 'Morning snack', lunch: 'Lunch', eveningSnack: 'Evening snack',
  close: 'Close the day: what’s left, and foods that fit', dinner: 'Dinner', checkin: 'Weekly check-in (Sundays)',
};
const time12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

function Section({ icon: Icon, title, hint, children }: { icon: typeof UserRound; title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="f-card p-5" aria-label={typeof title === 'string' ? title : undefined}>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-[var(--f-deep)]" aria-hidden />{title}</h2>
      {hint && <p className="f-muted mt-0.5 text-sm">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Password({ email }: { email: string }) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [state, setState] = useState<{ busy?: boolean; msg?: string; ok?: boolean }>({});
  const valid = f.current && f.next.length >= 6 && f.next === f.confirm;
  const submit = async () => {
    if (!valid || state.busy) return;
    setState({ busy: true });
    try {
      const r = await fetch('/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, currentPassword: f.current, newPassword: f.next }) });
      if (r.ok) { setState({ ok: true, msg: 'Password changed ✓' }); setF({ current: '', next: '', confirm: '' }); }
      else { const j = await r.json().catch(() => ({})); setState({ msg: j?.message || j?.error || 'Couldn’t change it. Check your current password.' }); }
    } catch { setState({ msg: 'Couldn’t reach the server. Try again.' }); }
  };
  const input = (key: keyof typeof f, label: string, auto: string) => (
    <label className="flex flex-col gap-1 text-sm"><span className="font-medium">{label}</span>
      <input className="f-input" type="password" autoComplete={auto} value={f[key]} onChange={e => { setF(x => ({ ...x, [key]: e.target.value })); setState({}); }} />
    </label>
  );
  return (
    <details className="group rounded-2xl border border-[var(--f-line)] p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" aria-hidden />Change password</summary>
      <div className="mt-3 space-y-3">
        {input('current', 'Current password', 'current-password')}
        {input('next', 'New password (6+ characters)', 'new-password')}
        {input('confirm', 'Confirm new password', 'new-password')}
        {f.confirm && f.next !== f.confirm && <p className="f-bad text-xs">The new passwords don’t match.</p>}
        {state.msg && <p className={`text-sm ${state.ok ? 'f-good font-semibold' : 'f-bad'}`} aria-live="polite">{state.msg}</p>}
        <button type="button" className="f-pill f-pill-primary w-full" disabled={!valid || state.busy} onClick={() => void submit()}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Change password
        </button>
      </div>
    </details>
  );
}

/** Everything that's yours: account, body stats and targets, measurements and photos, the Logs look, My Foods and reminders. */
export function ProfilePage({ data, onDataChange, user, onLogout, showcase = false }: {
  data: AppData; onDataChange: (d: AppData) => void; user: User; onLogout?: () => void; showcase?: boolean;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [look, setLook] = useFitLook(data, onDataChange);
  const foods = useFoods(showcase);
  const push = usePushNotifications();
  const [openTracker, setOpenTracker] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState('');
  const tracker = data.logTrackers.find(t => t.id === openTracker) ?? null;
  const kg = weightOn(data, today);
  const logs = showcase ? '/showcase/logs' : '/logs';
  const togglePush = async () => {
    try {
      if (push.status === 'on') { await push.disable(); setPushMsg('Notifications are off on this device.'); }
      else { await push.enable(); setPushMsg('Notifications on: a test one is on its way.'); }
    } catch (e) { setPushMsg((e as Error)?.message || 'Couldn’t change notifications.'); }
  };

  return (
    <div className={cn('fit-ui min-h-full', fitSerif.variable)}>
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-28 md:p-8">
        <Link href={logs} className="f-chip w-fit"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Logs</Link>
        <header className="f-hero flex items-center gap-4 p-5">
          <span className="fit-display flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--f-deep)] text-3xl text-white dark:text-[#04201f]" aria-hidden>
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="fit-display truncate text-[2rem]">{user.username}</h1>
            <p className="f-muted truncate text-sm">{user.email}{kg ? ` · ${kg.toFixed(1)} kg` : ''}{findTracker(data, 'weight')?.goal ? ` → ${findTracker(data, 'weight')!.goal} kg` : ''}</p>
          </div>
        </header>

        <Section icon={UserRound} title="About you & targets" hint="Used for your burn estimate, the rings and every suggestion. Synced to all your devices.">
          <TargetsForm data={data} today={today} onSave={onDataChange} />
        </Section>

        <Section icon={Ruler} title="Body" hint="Tape measurements and private progress photos: wins the scale doesn’t show.">
          <BodyCard data={data} today={today} onDataChange={onDataChange} onOpenTracker={setOpenTracker} showcase={showcase} />
        </Section>

        <Section icon={Palette} title="Logs look" hint="Colours for the Logs page. Saved to your account, so every device follows it.">
          <LookPicker look={look} onLook={setLook} />
        </Section>

        <Section icon={Utensils} title="My Foods" hint="Your saved foods with exact nutrition, so logging them needs no AI. Tap one to edit it, or add new ones with AI or by hand.">
          <FoodsPanel foods={foods} data={data} day={today} slot={slotForTime(new Date().getHours(), new Date().getMinutes())} aiDisabled={showcase} manage />
        </Section>

        <Section icon={Bell} title="Reminders" hint="Push notifications on this device. Each meal reminder is skipped once that meal is logged.">
          <ul className="f-card overflow-hidden">
            {SCHEDULE.map(r => (
              <li key={r.id} className="f-row text-sm">
                <span className="w-20 shrink-0 font-semibold tabular-nums">{time12(r.at)}</span>
                <span className="min-w-0 flex-1">{REMINDER_LABEL[r.id] ?? MEAL_SLOTS.find(s => s.id === r.id)?.label}</span>
              </li>
            ))}
          </ul>
          {showcase ? <p className="f-muted mt-3 text-sm">Sign in to turn on notifications.</p> : (
            <div className="mt-3 space-y-2">
              <button type="button" className={`f-pill w-full ${push.status === 'on' ? '' : 'f-pill-primary'}`} disabled={push.busy || push.status === 'loading' || push.status === 'unsupported' || push.status === 'blocked'} onClick={() => void togglePush()}>
                <Bell className="h-4 w-4" aria-hidden />
                {push.status === 'on' ? 'Turn off on this device' : push.status === 'blocked' ? 'Blocked in browser settings' : push.status === 'unsupported' ? 'Not supported here (add to Home Screen on iPhone)' : 'Turn on for this device'}
              </button>
              {pushMsg && <p className="f-muted text-sm" aria-live="polite">{pushMsg}</p>}
            </div>
          )}
        </Section>

        <Section icon={KeyRound} title="Account">
          <div className="space-y-3">
            {showcase ? <p className="f-muted text-sm">This is the demo account. Sign in to manage yours.</p> : <Password email={user.email} />}
            {onLogout && <button type="button" className="f-pill w-full" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden />Sign out</button>}
          </div>
        </Section>
      </div>
      <TrackerSheet tracker={tracker} data={data} day={today} today={today} aiDisabled={showcase} onClose={() => setOpenTracker(null)}
        onChange={p => onDataChange({ ...data, logTrackers: data.logTrackers.map(t => (t.id === openTracker ? { ...t, ...p } : t)) })}
        onDelete={() => { onDataChange({ ...data, logTrackers: data.logTrackers.filter(t => t.id !== openTracker) }); setOpenTracker(null); }} />
    </div>
  );
}
