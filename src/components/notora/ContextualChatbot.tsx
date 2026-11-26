
'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '@/contexts/app-context';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, Loader2, X, MessageSquare, Cpu, Check, ShieldCheck } from 'lucide-react';
import { applyAgentActions } from '@/ai/flows/apply-agent-actions';
import type { ProposedAction } from '@/lib/agent-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MicButton, appendSpeech } from './MicButton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { contextualChat } from '@/ai/flows/contextual-chat';
import { useModelStore } from '@/hooks/use-model-store';

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

export default function ContextualChatbot({ pageContext }: ContextualChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { selectedModel, webSearch } = useModelStore();
  const app = useContext(AppContext);

  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          role: 'model',
          content: "Hi! I'm Notora. Ask me anything about your tasks, notes, journal, links, trackers or food log, or ask me to add, change or delete something. I'll always show you the change and wait for your Confirm.",
        },
      ]);
    } else {
        setMessages([]);
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

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
      const r = await applyAgentActions(m.pending.map(p => p.action));
      setMsg(i, { status: r.applied.length ? 'applied' : 'failed', result: [r.applied.length ? `Done: ${r.applied.length} change${r.applied.length === 1 ? '' : 's'} saved.` : 'Nothing was changed.', ...r.skipped.map(x => `Skipped: ${x}`)].join(' ') });
      if (r.applied.length) await app?.reload();
    } catch (e: any) {
      setMsg(i, { status: 'failed', result: e?.message?.includes('another device') ? e.message : "Couldn't save the changes. Nothing was changed; try again." });
    }
  };

  return (
    <>
      <div className="fixed bottom-24 md:bottom-6 right-6 z-50">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="icon"
            className="rounded-full w-14 h-14 bg-primary text-primary-foreground shadow-lg"
          >
            {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className="fixed bottom-[120px] md:bottom-24 right-6 z-50"
          >
            <Card className="w-[350px] h-[500px] flex flex-col shadow-2xl dark:neon-dashboard">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot /> Notora
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex items-start gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'model' && (
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'p-3 rounded-lg max-w-[80%]',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          {message.pending?.length ? (
                            <div className="mt-2 rounded-md border bg-background/70 p-2 text-sm" role="group" aria-label="Proposed changes">
                              <p className="mb-1 flex items-center gap-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Waiting for your OK</p>
                              <ul className="list-disc space-y-0.5 pl-4 text-xs">{message.pending.map((p, j) => <li key={j}>{p.description}</li>)}</ul>
                              {message.status === 'waiting' || message.status === 'applying' ? (
                                <div className="mt-2 flex gap-2">
                                  <Button size="sm" className="h-8 flex-1" disabled={message.status === 'applying'} onClick={() => void confirm(index)}>
                                    {message.status === 'applying' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Confirm
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 flex-1" disabled={message.status === 'applying'}
                                    onClick={() => setMsg(index, { status: 'cancelled', result: 'Cancelled. Nothing was changed.' })}>Cancel</Button>
                                </div>
                              ) : (
                                <p className={cn('mt-2 text-xs', message.status === 'applied' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} aria-live="polite">{message.result}</p>
                              )}
                            </div>
                          ) : null}
                          {message.role === 'model' && message.modelId && (
                            <div className="text-xs opacity-50 flex items-center gap-1 pt-2">
                                <Cpu className="h-3 w-3" /> {message.modelId}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                        <div className="flex items-start gap-3 justify-start">
                             <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div className="p-3 rounded-lg bg-muted flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin"/>
                            </div>
                        </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <div className="flex w-full gap-2">
                  <Input
                    placeholder="Ask a question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading}
                  />
                  <MicButton onText={t => setInput(p => appendSpeech(p, t))} />
                  <Button onClick={handleSend} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

    