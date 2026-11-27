import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { AppData } from '@/lib/types';

// FinWise split's four looks, same palettes (tokens in fit.css). Lagoon is the default teal.
const LOOKS = [
  { id: 'lagoon', name: 'Lagoon', swatch: '#0b6f72' },
  { id: 'onyx', name: 'Onyx', swatch: '#111111' },
  { id: 'coral', name: 'Coral', swatch: '#c4334c' },
  { id: 'grape', name: 'Grape', swatch: '#4f2aa6' },
] as const;
export type LookId = (typeof LOOKS)[number]['id'];
const KEY = 'fit-look';

/**
 * The chosen look: saved with your data (so every device follows it), with
 * this device's last choice as a fallback before the data loads. Set on
 * <html> so the sheets (rendered outside the page) follow it.
 */
export function useFitLook(data?: AppData, onDataChange?: (d: AppData) => void): [LookId, (l: LookId) => void] {
  const [local, setLocal] = useState<LookId>('lagoon');
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (LOOKS.some(l => l.id === v)) setLocal(v as LookId); } catch { /* storage blocked: default look */ }
  }, []);
  const look: LookId = data?.logsLook ?? local;
  useEffect(() => {
    document.documentElement.dataset.fitLook = look;
    try { localStorage.setItem(KEY, look); } catch { /* not saved */ }
    return () => { delete document.documentElement.dataset.fitLook; };
  }, [look]);
  return [look, l => { setLocal(l); if (data && onDataChange) onDataChange({ ...data, logsLook: l }); }];
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
