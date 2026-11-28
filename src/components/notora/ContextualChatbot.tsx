
'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '@/contexts/app-context';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, Loader2, X, MessageSquare, Cpu, Check, Copy, ShieldCheck, Maximize2, Minimize2 } from 'lucide-react';
import '@/components/fit/fit.css';
import { fitSerif } from '@/components/fit/font';
import { applyAgentActions } from '@/ai/flows/apply-agent-actions';
import type { ProposedAction } from '@/lib/agent-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicButton, appendSpeech } from './MicButton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { contextualChat } from '@/ai/flows/contextual-chat';
import { useModelFor, useModelStore } from '@/hooks/use-model-store';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  modelId?: string;
  /** Changes the assistant proposed; nothing is applied until Confirm. */
  pending?: ProposedAction[];
  status?: 'waiting' | 'applying' | 'applied' | 'cancelled' | 'failed';
  result?: string;
}

interface ContextualChatbotProps {
  pageContext: any;
}

const GREETING = "Hi! I'm Notora. Ask me anything about your tasks, notes, journal, links, trackers or food log, or ask me to add, change or delete something. I'll always show you the change and wait for your Confirm.";

export default function ContextualChatbot({ pageContext }: ContextualChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  /** Full screen uses the Logs page look; the small panel keeps the app's own. */
  const [full, setFull] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fullScrollRef = useRef<HTMLDivElement>(null);
  const { webSearch } = useModelStore();
  const selectedModel = useModelFor('chat');
  const app = useContext(AppContext);

  // Greet once; closing the chat keeps the conversation (it's cleared only with "New chat").
  useEffect(() => {
    if (isOpen && !messages.length) {
      setMessages([{ role: 'model', content: GREETING }]);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape: leave full screen first, then close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (full) setFull(false); else setIsOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, full]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
    if (fullScrollRef.current) fullScrollRef.current.scrollTop = fullScrollRef.current.scrollHeight;
  }, [messages, full, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await contextualChat({
        // Tell the assistant how earlier proposals ended (confirmed, cancelled or failed).
        history: messages.map(({ role, content, result }) => ({ role, content: result ? `${content}\n(${result})` : content })),
        query: input,
        pageContext: JSON.stringify(pageContext, null, 2),
        webSearch,
      }, selectedModel);
      
      const aiMessage: ChatMessage = {
        role: 'model', content: result.response, modelId: result.modelId,
        ...(result.pending?.length ? { pending: result.pending, status: 'waiting' as const } : {}),
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const setMsg = (i: number, patch: Partial<ChatMessage>) => setMessages(prev => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  /** The only place assistant changes are applied: after the user taps Confirm. */
  const confirm = async (i: number) => {
    const m = messages[i];
    if (!m?.pending?.length || m.status !== 'waiting') return;
    setMsg(i, { status: 'applying' });
    try {
      // The server writes the change; this device's own saves wait until it's loaded back, so they can't race.
      const run = () => applyAgentActions(m.pending!.map(p => p.action));
      const r = app ? await app.serverWrite(run) : await run();
      setMsg(i, { status: r.applied.length ? 'applied' : 'failed', result: [r.applied.length ? `Done: ${r.applied.length} change${r.applied.length === 1 ? '' : 's'} saved.` : 'Nothing was changed.', ...r.skipped.map(x => `Skipped: ${x}`)].join(' ') });
    } catch (e: any) {
      setMsg(i, { status: 'failed', result: e?.message?.includes('another device') ? e.message : "Couldn't save the changes. Nothing was changed; try again." });
    }
  };

  const close = () => { setIsOpen(false); setFull(false); };
  const newChat = () => setMessages([{ role: 'model', content: GREETING }]);
  // Selecting text on a phone is fiddly: every reply gets a one-tap Copy.
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (i: number, text: string) => void navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(c => (c === i ? null : c)), 1500); }).catch(() => {});

  // One message list, styled for the small panel (app look) or full screen (Logs look).
  const list = (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div key={index} className={cn('flex items-start gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
          {message.role === 'model' && (
            <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', full ? 'bg-[var(--f-deep)] text-white dark:text-[#04201f]' : 'bg-primary text-primary-foreground')}>
              <Bot className="h-5 w-5" aria-hidden />
            </div>
          )}
          <div className={cn('max-w-[80%] p-3', full ? 'rounded-2xl' : 'rounded-lg',
            message.role === 'user' ? (full ? 'bg-[var(--f-deep)] text-white dark:text-[#04201f]' : 'bg-primary text-primary-foreground') : (full ? 'f-card' : 'bg-muted'))}>
            <p className={cn('select-text whitespace-pre-wrap', full ? 'text-[0.95rem] leading-relaxed' : 'text-sm')}>{message.content}</p>
            {message.pending?.length ? (
              <div className={cn('mt-2 p-2 text-sm', full ? 'rounded-xl border border-[var(--f-line)] bg-[var(--f-tint)]' : 'rounded-md border bg-background/70')} role="group" aria-label="Proposed changes">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Waiting for your OK</p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs">{message.pending.map((p, j) => <li key={j}>{p.description}</li>)}</ul>
                {message.status === 'waiting' || message.status === 'applying' ? (
                  <div className="mt-2 flex gap-2">
                    {full ? (
                      <>
                        <button type="button" className="f-pill f-pill-primary flex-1 !min-h-9" disabled={message.status === 'applying'} onClick={() => void confirm(index)}>
                          {message.status === 'applying' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}Confirm
                        </button>
                        <button type="button" className="f-pill flex-1 !min-h-9" disabled={message.status === 'applying'} onClick={() => setMsg(index, { status: 'cancelled', result: 'Cancelled. Nothing was changed.' })}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" className="h-8 flex-1" disabled={message.status === 'applying'} onClick={() => void confirm(index)}>
                          {message.status === 'applying' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 flex-1" disabled={message.status === 'applying'}
                          onClick={() => setMsg(index, { status: 'cancelled', result: 'Cancelled. Nothing was changed.' })}>Cancel</Button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className={cn('mt-2 text-xs', message.status === 'applied' ? 'text-green-600 dark:text-green-400' : 'opacity-70')} aria-live="polite">{message.result}</p>
                )}
              </div>
            ) : null}
            {message.role === 'model' && index > 0 && (
              <div className="flex items-center gap-3 pt-1 text-xs">
                <button type="button" className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 opacity-70" onClick={() => copy(index, message.content)} aria-label="Copy this reply">
                  {copied === index ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}{copied === index ? 'Copied' : 'Copy'}
                </button>
                {message.modelId && <span className="flex items-center gap-1 opacity-50"><Cpu className="h-3 w-3" aria-hidden /> {message.modelId}</span>}
              </div>
            )}
          </div>
          {message.role === 'user' && (
            <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', full ? 'bg-[var(--f-tint)]' : 'bg-muted')}><User className="h-5 w-5" aria-hidden /></div>
          )}
        </div>
      ))}
      {loading && (
        <div className="flex items-start justify-start gap-3">
          <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', full ? 'bg-[var(--f-deep)] text-white dark:text-[#04201f]' : 'bg-primary text-primary-foreground')}><Bot className="h-5 w-5" aria-hidden /></div>
          <div className={cn('flex items-center p-3', full ? 'f-card rounded-2xl' : 'rounded-lg bg-muted')}><Loader2 className="h-5 w-5 animate-spin" aria-label="Thinking" /></div>
        </div>
      )}
    </div>
  );

  const headerButtons = (cls: string) => (
    <div className="flex items-center gap-1">
      {messages.length > 1 && <button type="button" className={cn(cls, 'px-3 text-xs font-semibold')} onClick={newChat}>New chat</button>}
      <button type="button" className={cn(cls, 'w-10')} onClick={() => setFull(f => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
        {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <button type="button" className={cn(cls, 'w-10')} onClick={close} aria-label="Close chat" title="Close"><X className="h-5 w-5" /></button>
    </div>
  );

  const composer = (
    <div className="flex w-full items-center gap-2">
      {full ? (
        <input className="f-input min-w-0 flex-1" placeholder="Ask anything, or ask me to change something…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading} aria-label="Message Notora" autoFocus />
      ) : (
        <Input placeholder="Ask a question..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading} aria-label="Message Notora" />
      )}
      <MicButton onText={t => setInput(p => appendSpeech(p, t))} />
      {full ? (
        <button type="button" className="f-voice-btn h-11 w-11 shrink-0 !rounded-full" onClick={handleSend} disabled={loading} aria-label="Send">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      ) : (
        <Button onClick={handleSend} disabled={loading} aria-label="Send">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
      )}
    </div>
  );

  return (
    <>
      {!full && (
        <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button onClick={() => (isOpen ? close() : setIsOpen(true))} size="icon" className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg"
              aria-label={isOpen ? 'Close chat' : 'Open Notora chat'} aria-expanded={isOpen}>
              {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
            </Button>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {isOpen && full && (
          <motion.div key="full" role="dialog" aria-modal="true" aria-label="Notora chat"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cn('fit-ui fixed inset-0 bottom-[var(--kb,0px)] z-[60] flex flex-col', fitSerif.variable)}>
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3 pb-3">
                <h2 className="fit-display flex items-center gap-2 text-[1.9rem]"><Bot className="h-6 w-6 text-[var(--f-deep)]" aria-hidden />Notora <em>chat</em></h2>
                {headerButtons('f-icon-btn h-10')}
              </div>
              <div className="flex-1 overflow-y-auto pb-4" ref={fullScrollRef}>{list}</div>
              <div className="border-t border-[var(--f-line)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{composer}</div>
            </div>
          </motion.div>
        )}
        {isOpen && !full && (
          <motion.div key="small"
            initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="fixed bottom-[168px] right-4 z-50 md:bottom-24 md:right-6" role="dialog" aria-label="Notora chat">
            <Card className="flex h-[min(500px,calc(100dvh-10rem))] w-[min(350px,calc(100vw-2rem))] flex-col shadow-2xl dark:neon-dashboard">
              <CardHeader className="flex-row items-center justify-between space-y-0 py-3 pr-3">
                <CardTitle className="flex items-center gap-2 text-lg"><Bot aria-hidden /> Notora</CardTitle>
                {headerButtons('inline-flex h-10 items-center justify-center rounded-md hover:bg-muted')}
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>{list}</ScrollArea>
              </CardContent>
              <CardFooter>{composer}</CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
