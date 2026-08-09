
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, Loader2, X, MessageSquare, Cpu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { contextualChat } from '@/ai/flows/contextual-chat';
import { useModelStore } from '@/hooks/use-model-store';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  modelId?: string;
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
  const { selectedModel } = useModelStore();

  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          role: 'model',
          content: "Hello! I'm your AI assistant. Ask me anything about the content on this page.",
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
        history: messages,
        query: input,
        pageContext: JSON.stringify(pageContext, null, 2),
      }, selectedModel);
      
      const aiMessage: ChatMessage = { role: 'model', content: result.response, modelId: result.modelId };
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
                  <Bot /> AI Assistant
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
                          <p className="text-sm">{message.content}</p>
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

    