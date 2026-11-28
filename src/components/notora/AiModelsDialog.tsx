'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useModelStore } from '@/hooks/use-model-store';
import { MODEL_AREAS, PROVIDER_LABELS, PROVIDER_ORDER, TAG_LABELS, type CatalogModel } from '@/lib/model-catalog';

const SELECT = 'h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground';

/** One native picker (the iOS wheel on a phone), models grouped by provider. */
function ModelSelect({ id, value, models, onChange, fallbackLabel }: {
  id: string; value: string; models: CatalogModel[]; onChange: (key: string) => void; /** Shown as the first, empty option: "Same as default (…)". */ fallbackLabel?: string;
}) {
  return (
    <select id={id} className={SELECT} value={value} onChange={e => onChange(e.target.value)}>
      {fallbackLabel != null && <option value="">Same as default ({fallbackLabel})</option>}
      {PROVIDER_ORDER.map(p => {
        const list = models.filter(m => m.provider === p);
        return list.length ? (
          <optgroup key={p} label={PROVIDER_LABELS[p]}>
            {list.map(m => <option key={m.key} value={m.key}>{m.label}{m.tags[0] ? ` · ${TAG_LABELS[m.tags[0]]}` : ''}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

/** AI models (avatar menu): one default model, and a different one for any part of the app. Remembered on this device. */
export default function AiModelsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { availableModels, selectedModel, setModel, areaModels, setAreaModel } = useModelStore();
  const label = (key: string) => availableModels.find(m => m.key === key)?.label ?? key;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>AI models</DialogTitle>
          <DialogDescription>Pick the model the app uses, and a different one for any part of it. Remembered on this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="model-default" className="text-sm font-medium">Default model</label>
            <ModelSelect id="model-default" value={selectedModel} models={availableModels} onChange={setModel} />
          </div>
          <div className="space-y-3 border-t pt-4">
            {MODEL_AREAS.map(a => {
              // A saved model that is no longer on offer shows (and behaves) as "Same as default".
              const own = areaModels[a.id];
              const value = own && availableModels.some(m => m.key === own) ? own : '';
              return (
                <div key={a.id} className="space-y-1.5">
                  <label htmlFor={`model-${a.id}`} className="block text-sm font-medium">{a.label} <span className="block text-xs font-normal text-muted-foreground">{a.hint}</span></label>
                  <ModelSelect id={`model-${a.id}`} value={value} models={availableModels} fallbackLabel={label(selectedModel)} onChange={k => setAreaModel(a.id, k || null)} />
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
