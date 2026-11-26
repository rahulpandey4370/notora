import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

// FinWise split's four looks, same palettes (tokens in fit.css). Lagoon is the default teal.
const LOOKS = [
  { id: 'lagoon', name: 'Lagoon', swatch: '#0b6f72' },
  { id: 'onyx', name: 'Onyx', swatch: '#111111' },
  { id: 'coral', name: 'Coral', swatch: '#c4334c' },
  { id: 'grape', name: 'Grape', swatch: '#4f2aa6' },
] as const;
export type LookId = (typeof LOOKS)[number]['id'];
const KEY = 'fit-look';

/** The chosen look, saved on this device. Set on <html> so the sheets (rendered outside the page) follow it. */
export function useFitLook(): [LookId, (l: LookId) => void] {
  const [look, setLook] = useState<LookId>('lagoon');
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (LOOKS.some(l => l.id === v)) setLook(v as LookId); } catch { /* storage blocked: default look */ }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.fitLook = look;
    return () => { delete document.documentElement.dataset.fitLook; };
  }, [look]);
  return [look, l => { setLook(l); try { localStorage.setItem(KEY, l); } catch { /* not saved */ } }];
}

export function LookPicker({ look, onLook }: { look: LookId; onLook: (l: LookId) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Page colours">
      <span className="f-muted mr-1 text-xs font-semibold uppercase tracking-wide">Look</span>
      {LOOKS.map(l => (
        <button key={l.id} type="button" aria-pressed={look === l.id} aria-label={l.name} title={l.name} onClick={() => onLook(l.id)}
          className="flex h-11 w-11 items-center justify-center rounded-full">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${look === l.id ? 'ring-2 ring-[var(--f-ink)] ring-offset-2 ring-offset-[var(--f-bg)]' : 'ring-1 ring-[color-mix(in_srgb,var(--f-ink)_30%,transparent)]'}`}
            style={{ background: l.swatch }}>
            {look === l.id && <Check className="h-4 w-4" aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  );
}
