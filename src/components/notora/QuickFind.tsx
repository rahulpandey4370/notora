'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Search, StickyNote, BookOpen, Link2, CheckSquare, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicButton, appendSpeech } from './MicButton';
import { useApp } from '@/hooks/use-app';

type Hit = { kind: 'note' | 'journal' | 'link' | 'task'; id: string; title: string; snippet: string; href: string };

const ICONS = { note: StickyNote, journal: BookOpen, link: Link2, task: CheckSquare };

function snippet(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q);
  const start = Math.max(0, i - 30);
  return (start ? '…' : '') + text.slice(start, start + 110).replace(/\s+/g, ' ');
}

/**
 * One box to find anything (notes, journal, links, tasks) or capture a thought.
 * ⌘K / Ctrl+K opens it anywhere; Enter with no match saves the text as a new
 * sticky note on your first board.
 */
export default function QuickFind() {
  const { data, handleDataChange, toast } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase();
    if (!data || query.length < 2) return [];
    const has = (...parts: (string | undefined)[]) => parts.some(p => p?.toLowerCase().includes(query));
    const out: Hit[] = [];
    for (const b of data.noteBoards ?? []) for (const n of b.notes ?? []) {
      if (has(n.title, n.content)) out.push({ kind: 'note', id: n.id, title: n.title || 'Untitled note', snippet: snippet(n.content, query), href: `/notes?board=${b.id}` });
    }
    for (const j of data.journalEntries ?? []) {
      if (has(j.content, ...(j.tags ?? []))) out.push({ kind: 'journal', id: j.id, title: new Date(j.date).toDateString(), snippet: snippet(j.content, query), href: '/journal' });
    }
    for (const l of data.savedLinks ?? []) {
      if (has(l.title, l.summary, l.url)) out.push({ kind: 'link', id: l.id, title: l.title, snippet: snippet(l.summary || l.url, query), href: '/links' });
    }
    for (const t of data.tasks ?? []) {
      if (has(t.title)) out.push({ kind: 'task', id: t.id, title: t.title, snippet: t.date ? `Task · ${t.date.slice(0, 10)}` : `Task · ${t.type}`, href: '/tasks' });
    }
    return out.slice(0, 30);
  }, [data, q]);

  const go = (href: string) => { setOpen(false); setQ(''); router.push(href); };

  // Showcase/demo pages have no workspace to search or save into.
  if (!data) return null;

  const capture = () => {
    const text = q.trim();
    if (!data || !text) return;
    const board = data.noteBoards[0];
    if (!board) { toast({ variant: 'destructive', title: 'Create a notes board first' }); return; }
    const lowest = Math.max(-280, ...board.notes.map(n => n.position?.y ?? 0));
    const note = {
      id: uuidv4(), title: '', content: text, theme: 'yellow' as const,
      // New row under the existing notes so it doesn't cover one on desktop (mobile stacks anyway).
      position: { x: 24, y: lowest + 280 },
      history: { past: [], present: { title: '', content: text }, future: [] },
    };
    handleDataChange({ ...data, noteBoards: data.noteBoards.map(b => (b.id === board.id ? { ...b, notes: [note, ...b.notes] } : b)) });
    toast({ title: 'Saved to notes', description: `Added to “${board.title}”.` });
    setQ('');
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Search or capture a note (Ctrl+K)">
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">Search</span>
        <kbd className="ml-2 hidden lg:inline text-xs text-muted-foreground">⌘K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-lg top-[20%] translate-y-0">
          <DialogTitle className="sr-only">Search or capture</DialogTitle>
          <div className="p-3 border-b flex items-center gap-1">
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (hits[0] && !e.metaKey && !e.ctrlKey) go(hits[0].href);
                  else capture();
                }
              }}
              placeholder="Search everything, or type a thought and press Enter"
              aria-label="Search notes, journal, links and tasks"
            />
            <MicButton onText={t => setQ(p => appendSpeech(p, t))} />
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1">
            {hits.map(h => {
              const Icon = ICONS[h.kind];
              return (
                <button key={`${h.kind}-${h.id}`} onClick={() => go(h.href)}
                  className="w-full text-left flex gap-3 items-start rounded-md px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none">
                  <Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{h.title}</span>
                    <span className="block text-sm text-muted-foreground truncate">{h.snippet}</span>
                  </span>
                </button>
              );
            })}
            {q.trim() && (
              <button onClick={capture}
                className="w-full text-left flex gap-3 items-center rounded-md px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none">
                <Plus className="h-4 w-4 text-primary" />
                <span className="truncate">Save “{q.trim().slice(0, 60)}” as a note{hits.length ? ' (⌘↵)' : ''}</span>
              </button>
            )}
            {!q.trim() && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Find notes, journal entries, links and tasks, or jot something down.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
