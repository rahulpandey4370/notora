import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Camera, Check, Dumbbell, Footprints, Globe, Loader2, Mic, Send, Square, Utensils, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { AppData } from '@/lib/types';
import { useModelStore } from '@/hooks/use-model-store';
import { parseFitnessLog } from '@/ai/flows/parse-fitness-log';
import { MEAL_SLOTS, bmr, describeValueChange, slotForTime, weightOn, type FitnessDraft } from '@/lib/fitness';
import type { MealSlot } from '@/lib/types';
import type { AddTarget } from './DayLog';
import { ManualLog } from './ManualLog';

const FORM_KEY = 'fit-log-form'; // remembers whether the user last chose the no-AI form

const SR = () => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

/** Phone photos are 3-8 MB; server actions take 1 MB. 1280px JPEG is plenty for the model. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo. Try a JPEG or PNG.")); };
    img.src = url;
  });
}

type Msg = { role: 'user' | 'ai'; text: string; image?: string; error?: boolean };
const EMPTY = (date: string): FitnessDraft => ({ date, meals: [], activities: [], values: [] });

function NumField({ label, value, onChange, width = 'w-16' }: { label: string; value: number; onChange: (n: number) => void; width?: string }) {
  return (
    <label className={cn('flex flex-col text-[11px]', width)}>
      <span className="f-muted">{label}</span>
      <input className="f-input mt-0.5 !px-2 !py-1 text-sm tabular-nums" type="number" inputMode="decimal" min={0} step="any"
        defaultValue={value} onChange={e => { const v = e.target.value.trim(); const n = Number(v); if (v !== "" && Number.isFinite(n) && n >= 0) onChange(n); }} />
    </label>
  );
}

/** "Log it": type, speak or snap → AI draft cards → Save. Nothing is written before Save. */
export function LogSheet({ open, onOpenChange, mode, preset, data, day, today, onSave, aiDisabled }: {
  open: boolean; onOpenChange: (o: boolean) => void; mode: 'type' | 'voice' | 'photo' | 'form'; preset?: AddTarget;
  data: AppData; day: string; today: string; onSave: (draft: FitnessDraft) => void; aiDisabled?: boolean;
}) {
  const { selectedModel, webSearch, setWebSearch } = useModelStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState<FitnessDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(false);
  const [manual, setManual] = useState(false);
  const [ver, setVer] = useState(0); // bumps on each AI reply so number fields re-read their values
  const recRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0); // newest request id: older replies, or ones from a closed sheet, are dropped
  const supported = typeof window !== 'undefined' && !!SR();
  // Meals logged for today default to the section for this time of day; for another day, lunch.
  const nowSlot: MealSlot = day === today ? slotForTime(new Date().getHours(), new Date().getMinutes()) : 'lunch';

  useEffect(() => {
    reqRef.current++;
    if (open) {
      setMsgs([]); setText(''); setInterim(''); setPhoto(null); setDraft(null); setSaved(false);
      let form = false;
      try { form = mode === 'form' || (mode === 'type' && localStorage.getItem(FORM_KEY) === '1'); } catch { form = mode === 'form'; }
      setManual(form);
      if (form) { /* the form takes focus on tap */ }
      else if (mode === 'photo') setTimeout(() => fileRef.current?.click(), 80);
      else if (mode === 'voice' && SR()) start();
      else setTimeout(() => inputRef.current?.focus(), 150);
    } else stop();
    return () => recRef.current?.abort?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, draft, busy]);

  function start() {
    const Rec = SR();
    if (!Rec) return;
    recRef.current?.abort?.();
    const rec = new Rec();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finals = '', live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript ?? '';
        if (e.results[i].isFinal) finals += t; else live += t;
      }
      if (finals) setText(prev => `${prev} ${finals}`.trim());
      setInterim(live);
    };
    rec.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setMsgs(m => [...m, { role: 'ai', text: 'The microphone is blocked. Allow it, or just type below.', error: true }]);
      }
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }
  function stop() { recRef.current?.stop?.(); setListening(false); }

  const pick = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await downscale(file)); setTimeout(() => inputRef.current?.focus(), 50); }
    catch (e: any) { setMsgs(m => [...m, { role: 'ai', text: e.message, error: true }]); }
  };

  const send = async () => {
    if (busy) return;
    stop();
    const said = `${text} ${interim}`.trim();
    if (!said && !photo) return;
    const image = photo ?? undefined;
    setMsgs(m => [...m, { role: 'user', text: said, image }]);
    setText(''); setInterim(''); setPhoto(null); setSaved(false);
    if (aiDisabled) {
      // Showcase: a fixed sample so the draft cards and Save can be tried without AI.
      setDraft({ date: day, meals: [{ name: '2 rotis', kcal: 220, proteinG: 6, slot: nowSlot }], activities: [{ name: 'Jog', minutes: 30, kcal: 320, stepBased: true }], values: [] });
      setVer(v => v + 1);
      setMsgs(m => [...m, { role: 'ai', text: 'Demo: a sample result. Sign in for real AI logging.' }]);
      return;
    }
    setBusy(true);
    const req = ++reqRef.current;
    const kg = weightOn(data, day);
    try {
      const r = await parseFitnessLog({
        message: said, image, todayYmd: today, dayYmd: day,
        trackers: data.logTrackers.map(t => ({ id: t.id, name: t.name, unit: t.unit })),
        weightKg: kg,
        bmrKcal: data.fitnessProfile && kg ? bmr(data.fitnessProfile, kg, day) : undefined,
        currentDraft: draft && (draft.meals.length || draft.activities.length || draft.values.length) ? draft : undefined,
        webSearch,
        localTime: format(new Date(), 'HH:mm'),
      }, selectedModel);
      if (req !== reqRef.current) return;
      const { reply, web, ...next } = r;
      next.meals = next.meals.map(m => (m.slot ? m : { ...m, slot: nowSlot })); // the AI couldn't tell: file it under the meal for this time of day
      setDraft(next);
      setVer(v => v + 1);
      const text = reply || 'Here’s what I got. Check the numbers, then Save.';
      setMsgs(m => [...m, { role: 'ai', text: web ? `${text} 🌐 Checked the web.` : webSearch ? `${text} (Web search found nothing, so these are estimates.)` : text }]);
    } catch {
      if (req === reqRef.current) setMsgs(m => [...m, { role: 'ai', text: "Couldn't read that. Check your connection and try again.", error: true }]);
    } finally { if (req === reqRef.current) setBusy(false); }
  };

  const update = (fn: (d: FitnessDraft) => FitnessDraft) => setDraft(d => (d ? fn(d) : d));
  const remove = (fn: (d: FitnessDraft) => FitnessDraft) => { update(fn); setVer(v => v + 1); };
  const hasItems = !!draft && (draft.meals.length + draft.activities.length + draft.values.length) > 0;
  const trackerName = (id: string) => data.logTrackers.find(t => t.id === id);
  const save = () => {
    if (!draft || !hasItems || busy) return;
    onSave(draft);
    setSaved(true);
    setDraft(EMPTY(day));
    setMsgs(m => [...m, { role: 'ai', text: 'Saved ✓ Anything else?' }]);
  };
  const chooseManual = (m: boolean) => {
    if (m) stop();
    setManual(m);
    try { localStorage.setItem(FORM_KEY, m ? '1' : '0'); } catch { /* not remembered */ }
  };
  const dayText = draft && draft.date !== day ? ` for ${new Date(`${draft.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="fit-ui f-sheet flex max-h-[92dvh] flex-col gap-0 rounded-t-[28px] border-0 p-0 sm:mx-auto sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 pr-12">
          <div>
            <SheetTitle className="fit-display text-2xl text-[var(--f-ink)]">Log <em>it</em></SheetTitle>
            <SheetDescription className="f-muted text-sm">{manual ? 'Fill in the numbers yourself. No AI.' : 'Meals, workouts or numbers — type, speak, or send a photo.'}</SheetDescription>
          </div>
          <div className="flex shrink-0 gap-1" role="group" aria-label="How to log">
            <button type="button" className="f-chip" data-on={!manual} aria-pressed={!manual} onClick={() => chooseManual(false)}>AI</button>
            <button type="button" className="f-chip" data-on={manual} aria-pressed={manual} onClick={() => chooseManual(true)}>Form</button>
          </div>
        </div>

        {manual ? (
          <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
            <ManualLog key={`${preset?.kind ?? ''}-${preset?.kind === 'meal' ? preset.slot : ''}`} data={data} day={day} onSave={onSave}
              initialKind={preset?.kind ?? 'meal'} defaultSlot={preset?.kind === 'meal' ? preset.slot : nowSlot} />
          </div>
        ) : (<>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-2" aria-live="polite">
          {!msgs.length && (
            <div className="f-muted space-y-1 text-sm">
              <p>Try:</p>
              <p>“2 rotis, dal and a 30 min jog”</p>
              <p>“94.1 kg, 110 g protein”</p>
              <p>📷 a meal, or a screenshot of a workout summary</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-[var(--f-deep)] text-white dark:text-[#04201f]' : m.error ? 'bg-[var(--f-coral-soft)] text-[var(--f-ink)]' : 'f-card')}>
                {m.image && <img src={m.image} alt="Photo you sent" className="mb-1.5 max-h-40 rounded-xl" />}
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="f-muted flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Reading…</div>}

          {hasItems && draft && (
            <div className="f-card space-y-2 p-3" aria-label="Draft to save">
              <p className="text-xs font-semibold uppercase tracking-wide f-muted">To save{dayText}</p>
              {draft.meals.map((m, i) => (
                <div key={`m${ver}-${i}`} className="flex items-end gap-2">
                  <Utensils className="mb-2 h-4 w-4 shrink-0 text-[var(--f-chart-a)]" aria-hidden />
                  <span className="mb-1.5 min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <select className="f-muted mt-0.5 max-w-full bg-transparent text-xs underline decoration-dotted underline-offset-2" aria-label={`Meal for ${m.name}`}
                      value={m.slot ?? nowSlot} onChange={e => update(d => ({ ...d, meals: d.meals.map((x, j) => (j === i ? { ...x, slot: e.target.value as MealSlot } : x)) }))}>
                      {MEAL_SLOTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </span>
                  <NumField label="kcal" value={m.kcal} onChange={n => update(d => ({ ...d, meals: d.meals.map((x, j) => (j === i ? { ...x, kcal: n } : x)) }))} />
                  <NumField label="protein g" value={m.proteinG} onChange={n => update(d => ({ ...d, meals: d.meals.map((x, j) => (j === i ? { ...x, proteinG: n } : x)) }))} />
                  <button type="button" className="f-muted -mr-2 mb-0 flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Remove ${m.name}`}
                    onClick={() => remove(d => ({ ...d, meals: d.meals.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {draft.activities.map((a, i) => (
                <div key={`a${ver}-${i}`} className="flex items-end gap-2">
                  {a.stepBased ? <Footprints className="mb-2 h-4 w-4 shrink-0 text-[var(--f-chart-b)]" aria-hidden /> : <Dumbbell className="mb-2 h-4 w-4 shrink-0 text-[var(--f-chart-b)]" aria-hidden />}
                  <span className="mb-1.5 min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                  <NumField label="min" value={a.minutes} onChange={n => update(d => ({ ...d, activities: d.activities.map((x, j) => (j === i ? { ...x, minutes: n } : x)) }))} />
                  <NumField label="kcal" value={a.kcal} onChange={n => update(d => ({ ...d, activities: d.activities.map((x, j) => (j === i ? { ...x, kcal: n } : x)) }))} />
                  <button type="button" className="f-muted -mr-2 mb-0 flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Remove ${a.name}`}
                    onClick={() => remove(d => ({ ...d, activities: d.activities.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></button>
                </div>
              ))}
              {draft.values.map((v, i) => {
                const t = trackerName(v.trackerId);
                const note = describeValueChange(data, draft, v);
                return (
                  <div key={`v${ver}-${i}`}>
                    <div className="flex items-end gap-2">
                      <span className="mb-1.5 min-w-0 flex-1 truncate text-sm font-medium">{t?.name ?? 'Tracker'}</span>
                      <NumField label={t?.unit ?? ''} value={v.value} width="w-24"
                        onChange={n => update(d => ({ ...d, values: d.values.map((x, j) => (j === i ? { ...x, value: n } : x)) }))} />
                      <button type="button" className="f-muted -mr-2 mb-0 flex h-11 w-11 shrink-0 items-center justify-center" aria-label={`Remove ${t?.name}`}
                        onClick={() => remove(d => ({ ...d, values: d.values.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></button>
                    </div>
                    {note && <p className="f-muted text-xs">{note}</p>}
                  </div>
                );
              })}
              <button type="button" className="f-pill f-pill-primary mt-1 w-full" disabled={busy} onClick={save}><Check className="h-4 w-4" aria-hidden />Save</button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-[var(--f-line)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {photo && (
            <div className="mb-2 flex items-center gap-2">
              <img src={photo} alt="Photo to send" className="h-14 w-14 rounded-xl object-cover" />
              <button type="button" className="f-chip" onClick={() => setPhoto(null)}><X className="h-3.5 w-3.5" aria-hidden />Remove photo</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" className="f-icon-btn h-11 w-11 shrink-0" aria-label="Add a photo" onClick={() => fileRef.current?.click()}><Camera className="h-5 w-5" /></button>
            <button type="button" className={cn('f-icon-btn h-11 w-11 shrink-0', webSearch && '!border-[var(--f-deep)] !bg-[var(--f-deep)] !text-white dark:!text-[#04201f]')}
              aria-label={`Web search ${webSearch ? 'on' : 'off'}`} aria-pressed={webSearch} title={webSearch ? 'Web search on' : 'Web search off'} onClick={() => setWebSearch(!webSearch)}>
              <Globe className="h-5 w-5" />
            </button>
            <textarea ref={inputRef} rows={1} className="f-input max-h-28 min-h-[2.75rem] flex-1 resize-none"
              placeholder={listening ? 'Listening…' : draft && hasItems ? 'Correct it, e.g. “make it 3 rotis”' : 'What did you eat or do?'}
              value={interim ? `${text} ${interim}`.trim() : text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} aria-label="Message" />
            {supported && (
              <button type="button" className={cn('f-icon-btn h-11 w-11 shrink-0', listening && '!bg-[var(--f-coral)] !text-white')}
                aria-label={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening} onClick={() => (listening ? stop() : start())}>
                {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
              </button>
            )}
            <button type="button" className="f-voice-btn h-11 w-11 shrink-0 !rounded-full" aria-label="Send" disabled={busy} onClick={() => void send()}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
}
