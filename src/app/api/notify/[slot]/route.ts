import { recurringShowsOn } from '@/lib/tasks';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { pushConfigured, sendPushOnce } from '@/lib/push';
import { healthConfigured, ReconnectNeeded, recentHealthDays, syncHealth } from '@/lib/health';
import type { AppData, Task } from '@/lib/types';

/**
 * Called by Supabase pg_cron (supabase/notora-v2.sql):
 *   morning (7:30 AM): sync Fitbit, then "today's plan + last night's sleep"
 *   evening (9 PM):    open tasks + journal nudge
 * Authorization: Bearer CRON_SECRET. Times are in APP_TIMEZONE (default Asia/Kolkata).
 */
export const maxDuration = 60;

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const ymdInTz = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
/** Stored dates are 'yyyy-MM-dd' now, full ISO strings in older data. */
const ymdOf = (v?: string) => (!v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ymdInTz(new Date(v)));

function tasksForToday(tasks: Task[], today: string): Task[] {
  return tasks.filter(t => {
    if (t.type === 'single') return ymdOf(t.date) === today;
    // Same rule as the Tasks page (src/lib/tasks.ts), with the start date in the app's time zone.
    if (t.type === 'recurring') return recurringShowsOn(t, today, ymdOf(t.createdAt));
    return false;
  });
}

const list = (titles: string[]) => titles.slice(0, 3).join(', ') + (titles.length > 3 ? ` +${titles.length - 3} more` : '');
const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

export async function POST(req: Request, { params }: { params: Promise<{ slot: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slot } = await params;
  if (slot !== 'morning' && slot !== 'evening') return NextResponse.json({ error: 'Unknown slot' }, { status: 404 });

  const supabase = getSupabase();
  const today = ymdInTz(new Date());
  const yesterday = ymdInTz(new Date(Date.now() - 86400_000));
  const report: Record<string, unknown> = {};

  // Everyone with a device subscribed or Fitbit connected.
  const [{ data: subs }, { data: conns }] = await Promise.all([
    supabase.from('push_subscriptions').select('username'),
    healthConfigured() ? supabase.from('health_connections').select('username, status') : Promise.resolve({ data: [] as { username: string; status: string }[] }),
  ]);
  const users = [...new Set([...(subs ?? []), ...(conns ?? [])].map(r => r.username))];

  for (const username of users) {
    const out: string[] = [];
    try {
      const conn = conns?.find(c => c.username === username);
      if (slot === 'morning' && conn?.status === 'connected') {
        try {
          const r = await syncHealth(username, 3);
          out.push(`synced ${r.days}d${r.errors.length ? ` (${r.errors.length} errors)` : ''}`);
        } catch (e) {
          if (e instanceof ReconnectNeeded && pushConfigured()) {
            await sendPushOnce(`fitbit-reconnect:${username}:${today}`, username, {
              title: '⌚ Reconnect Fitbit',
              body: 'Google ended the connection, so health data stopped syncing. Tap to reconnect.',
              url: '/logs', tag: 'fitbit',
            });
          }
          out.push(`sync failed: ${(e as Error).message}`);
        }
      }
      if (!pushConfigured() || !subs?.some(s => s.username === username)) { report[username] = out; continue; }

      const { data: row } = await supabase.from('app_data').select('data').eq('username', username).maybeSingle();
      const data = row?.data as AppData | undefined;
      if (!data) { report[username] = out; continue; }
      const todays = tasksForToday(data.tasks ?? [], today);
      const open = todays.filter(t => !(t.completions ?? []).includes(today));

      let payload: { title: string; body: string; url: string } | null = null;
      if (slot === 'morning') {
        const health = (await recentHealthDays(username, 3));
        const night = health.find(d => d.date === today)?.sleep_minutes;
        const steps = health.find(d => d.date === yesterday)?.steps;
        const bits = [
          open.length ? `Top: ${list(open.map(t => t.title))}` : 'No tasks planned yet: add a few?',
          night ? `Slept ${hm(night)}` : null,
          steps ? `${steps.toLocaleString('en-IN')} steps yesterday` : null,
        ].filter(Boolean);
        payload = {
          title: `☀️ Good morning: ${open.length} task${open.length === 1 ? '' : 's'} today`,
          body: bits.join(' · '),
          url: '/tasks',
        };
      } else {
        const journaled = (data.journalEntries ?? []).some(j => ymdOf(j.date) === today);
        if (open.length || !journaled) {
          payload = {
            title: open.length ? `🌙 ${open.length} task${open.length === 1 ? '' : 's'} still open` : '🌙 How was today?',
            body: [open.length ? list(open.map(t => t.title)) : null, journaled ? null : 'Take two minutes to journal.'].filter(Boolean).join(' · '),
            url: open.length ? '/tasks' : '/journal',
          };
        }
      }
      if (payload) {
        const sent = await sendPushOnce(`${slot}:${username}:${today}`, username, { ...payload, tag: slot });
        out.push(sent ? 'sent' : 'not sent (already sent or no device)');
      } else out.push('nothing to say');
    } catch (e) {
      out.push(`error: ${(e as Error).message}`);
    }
    report[username] = out;
  }
  return NextResponse.json({ slot, today, report });
}

/** Lets you trigger it from a browser/curl GET too, with the same secret. */
export const GET = POST;
