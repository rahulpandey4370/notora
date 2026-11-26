import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SR = () => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

/** Adds a dictated phrase to the end of what's already typed. */
export const appendSpeech = (prev: string, said: string) => (prev.trim() ? `${prev.trimEnd()} ${said}` : said);

/**
 * Dictation for any text field: tap to talk, tap again to stop. Each finished phrase
 * goes to `onText` (use `appendSpeech` in a state setter). Hidden where the browser has no speech recognition.
 */
export function MicButton({ onText, className }: { onText: (said: string) => void; className?: string }) {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => { setSupported(!!SR()); return () => rec.current?.abort?.(); }, []);
  if (!supported) return null;

  const toggle = () => {
    if (on) { rec.current?.stop?.(); return; }
    const r = new (SR())();
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i].isFinal ? String(e.results[i][0]?.transcript ?? '').trim() : '';
        if (t) cb.current(t);
      }
    };
    r.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        toast({ title: 'Microphone blocked', description: 'Allow microphone access in your browser to dictate.', variant: 'destructive' });
      }
    };
    r.onend = () => setOn(false);
    rec.current = r;
    try { r.start(); setOn(true); } catch { setOn(false); }
  };

  return (
    <Button type="button" variant="ghost" size="icon" aria-label={on ? 'Stop dictating' : 'Dictate'} aria-pressed={on} title={on ? 'Stop dictating' : 'Dictate'}
      onClick={e => { e.stopPropagation(); toggle(); }} className={cn('shrink-0', on && 'text-red-600 motion-safe:animate-pulse', className)}>
      {on ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
