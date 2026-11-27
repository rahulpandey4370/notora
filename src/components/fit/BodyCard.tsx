import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Camera, ChevronRight, Loader2, Plus } from 'lucide-react';
import type { AppData, LogTracker, ProgressPhoto } from '@/lib/types';
import { weightOn } from '@/lib/fitness';
import { deleteProgressPhoto, progressPhotoUrls, uploadProgressPhoto } from '@/lib/progress-photos';
import { downscale } from './LogSheet';
import { ConfirmDelete } from './TrackerSheet';

const MEASURES = ['Waist', 'Hips', 'Chest', 'Arm', 'Thigh', 'Neck'];
const SHRINK_GOOD = new Set(['waist', 'hips', 'thigh', 'neck']); // arm and chest can grow with muscle
const POSES: ProgressPhoto['pose'][] = ['front', 'side', 'back'];
const short = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const isMeasure = (t: LogTracker) => t.unit === 'cm' || MEASURES.some(m => m.toLowerCase() === t.name.trim().toLowerCase());

/** Wins beyond the scale: tape measurements, and private progress photos compared side by side. */
export function BodyCard({ data, today, onDataChange, onOpenTracker, showcase }: {
  data: AppData; today: string; onDataChange: (d: AppData) => void; onOpenTracker: (id: string) => void; showcase?: boolean;
}) {
  const measures = data.logTrackers.filter(isMeasure);
  const [which, setWhich] = useState(measures[0]?.name ?? 'Waist');
  const [cm, setCm] = useState('');
  const [saved, setSaved] = useState('');
  const value = Number(cm);
  const valid = cm.trim() !== '' && Number.isFinite(value) && value > 0 && value < 300;

  const addMeasure = () => {
    if (!valid) return;
    const existing = data.logTrackers.find(t => t.name.trim().toLowerCase() === which.toLowerCase());
    const entry = { id: uuidv4(), date: today, value: Math.round(value * 10) / 10 };
    const trackers = existing
      ? data.logTrackers.map(t => (t.id === existing.id ? { ...t, logs: [...t.logs.filter(l => l.date !== today), entry].sort((a, b) => a.date.localeCompare(b.date)) } : t))
      : [...data.logTrackers, { id: uuidv4(), name: which, unit: 'cm', logs: [entry] }];
    onDataChange({ ...data, logTrackers: trackers });
    setCm(''); setSaved(`${which} ${entry.value} cm saved ✓`);
  };

  return (
    <div className="space-y-6">
      <section aria-label="Measurements" className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Measurements</h3>
          <p className="f-muted text-xs">When the scale stalls, the tape often doesn’t. Measure in the morning, same spot, tape snug but not tight (waist at the navel).</p>
        </div>
        {measures.length > 0 && (
          <ul className="f-card overflow-hidden">
            {measures.map(t => {
              const logs = [...t.logs].filter(l => l.value > 0).sort((a, b) => a.date.localeCompare(b.date));
              const first = logs[0], last = logs[logs.length - 1];
              const change = first && last && first !== last ? Math.round((last.value - first.value) * 10) / 10 : null;
              const good = change == null || change === 0 ? null : SHRINK_GOOD.has(t.name.toLowerCase()) ? change < 0 : null;
              return (
                <li key={t.id}>
                  <button type="button" className="f-row w-full text-left" onClick={() => onOpenTracker(t.id)} aria-label={`Open ${t.name}`}>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.name}</span>
                      <span className="f-muted block text-xs">{last ? `${short(last.date)}` : 'No entries yet'}{change != null ? ` · ${change > 0 ? '+' : '−'}${Math.abs(change)} cm since ${short(first.date)}` : ''}</span></span>
                    <span className={`text-sm font-bold tabular-nums ${good === true ? 'f-good' : good === false ? 'f-bad' : ''}`}>{last ? `${last.value} cm` : '—'}</span>
                    <ChevronRight className="f-muted h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <select className="f-input w-auto" value={which} onChange={e => { setWhich(e.target.value); setSaved(''); }} aria-label="Measurement">
            {[...new Set([...MEASURES, ...measures.map(t => t.name)])].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input className="f-input w-28" type="number" inputMode="decimal" step="any" min={0} placeholder="cm" value={cm} onChange={e => { setCm(e.target.value); setSaved(''); }}
            onKeyDown={e => e.key === 'Enter' && addMeasure()} aria-label={`${which} in cm`} />
          <button type="button" className="f-pill f-pill-primary flex-1" disabled={!valid} onClick={addMeasure}><Plus className="h-4 w-4" aria-hidden />Save for today</button>
        </div>
        {saved && <p className="f-good text-sm font-semibold" aria-live="polite">{saved}</p>}
      </section>

      <Photos data={data} today={today} onDataChange={onDataChange} showcase={showcase} />
    </div>
  );
}

function Photos({ data, today, onDataChange, showcase }: { data: AppData; today: string; onDataChange: (d: AppData) => void; showcase?: boolean }) {
  const photos = useMemo(() => [...(data.progressPhotos ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [data.progressPhotos]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ofPose = photos.filter(p => p.pose === pose);
  const [pair, setPair] = useState<{ a?: string; b?: string }>({});
  const a = ofPose.find(p => p.id === pair.a) ?? ofPose[0];
  const b = ofPose.find(p => p.id === pair.b) ?? ofPose[ofPose.length - 1];

  const paths = photos.map(p => p.path).join('|');
  useEffect(() => {
    if (showcase || !photos.length) return;
    let live = true;
    progressPhotoUrls(photos.map(p => p.path)).then(u => { if (live) setUrls(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [paths, showcase]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const r = await uploadProgressPhoto(await downscale(file));
      if (!r.ok) { setError(r.error); return; }
      onDataChange({ ...data, progressPhotos: [...(data.progressPhotos ?? []), { id: uuidv4(), date: today, path: r.path, pose }] });
    } catch (e) {
      setError((e as Error).message || 'Couldn’t upload that photo.');
    } finally { setBusy(false); }
  };
  const remove = (p: ProgressPhoto) => {
    onDataChange({ ...data, progressPhotos: (data.progressPhotos ?? []).filter(x => x.id !== p.id) });
    void deleteProgressPhoto(p.path).catch(() => undefined);
  };
  const kg = (d: string) => { const w = weightOn(data, d); return w ? `${w.toFixed(1)} kg` : ''; };
  const frame = (p: ProgressPhoto | undefined, label: string) => (
    <figure className="min-w-0 flex-1">
      <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-[var(--f-tint)]">
        {p && urls[p.path] ? <img src={urls[p.path]} alt={`${label}: ${p.pose} photo from ${short(p.date)}`} className="h-full w-full object-cover" />
          : <div className="f-muted flex h-full items-center justify-center text-xs">{p ? 'Loading…' : 'No photo'}</div>}
      </div>
      <figcaption className="mt-1 text-center text-xs"><strong>{label}</strong>{p ? ` · ${short(p.date)}${kg(p.date) ? ` · ${kg(p.date)}` : ''}` : ''}</figcaption>
    </figure>
  );

  return (
    <section aria-label="Progress photos" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Progress photos</h3>
        <p className="f-muted text-xs">Private to your account (never public; links expire after 10 minutes). Same spot, light and pose every 2–4 weeks.</p>
      </div>
      {showcase ? <p className="f-muted text-sm">Sign in to add photos: they’re stored privately for your account.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Pose">
              {POSES.map(x => <button key={x} type="button" className="f-chip !min-h-9 capitalize" data-on={pose === x} aria-pressed={pose === x} onClick={() => { setPose(x); setPair({}); }}>{x}</button>)}
            </div>
            <button type="button" className="f-pill flex-1" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}{busy ? 'Uploading…' : `Add a ${pose} photo`}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void add(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {error && <p className="f-bad text-sm" aria-live="polite">{error}</p>}
          {ofPose.length >= 2 ? (
            <>
              <div className="flex gap-3">{frame(a, 'Before')}{frame(b, 'After')}</div>
              <div className="flex gap-2">
                {(['a', 'b'] as const).map(side => (
                  <select key={side} className="f-input min-w-0 flex-1 !py-2 text-sm" value={(side === 'a' ? a : b)?.id} onChange={e => setPair(p => ({ ...p, [side]: e.target.value }))} aria-label={side === 'a' ? 'Before photo' : 'After photo'}>
                    {ofPose.map(p => <option key={p.id} value={p.id}>{short(p.date)}</option>)}
                  </select>
                ))}
              </div>
            </>
          ) : ofPose.length === 1 ? <div className="flex gap-3">{frame(ofPose[0], 'Start')}<div className="f-muted flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--f-line)] p-4 text-center text-xs">Add another {pose} photo in a few weeks to compare.</div></div>
            : <p className="f-muted text-sm">No {pose} photos yet.</p>}
          {photos.length > 0 && (
            <ul className="f-card overflow-hidden">
              {[...photos].reverse().map(p => (
                <li key={p.id} className="f-row">
                  <span className="min-w-0 flex-1 text-sm"><span className="font-semibold capitalize">{p.pose}</span> · {short(p.date)}{kg(p.date) ? ` · ${kg(p.date)}` : ''}</span>
                  <ConfirmDelete label="Delete" confirm="Sure?" className="!min-h-9 !px-3 !text-xs" onConfirm={() => remove(p)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
