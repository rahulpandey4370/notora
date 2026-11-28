'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { customTransformStickyNote } from '@/ai/flows/custom-transform-sticky-note';
import { Loader2, Sparkles } from 'lucide-react';
import type { StickyNote } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { MicButton, appendSpeech } from './MicButton';
import { useModelFor } from '@/hooks/use-model-store';
import { useToast } from '@/hooks/use-toast';
import { useAsk } from '@/hooks/use-ask';

interface CustomPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteContent: string;
  noteId: string;
  onContentChange: (id: string, newContent: Partial<StickyNote>) => void;
}

export default function CustomPromptDialog({
  open,
  onOpenChange,
  noteContent,
  noteId,
  onContentChange,
}: CustomPromptDialogProps) {
  const [prompt, setPrompt] = useState('');
  // lib/ask: idle → pending → ready | failed. Closing resets it, so a reply still on its way is dropped.
  const transform = useAsk<string>();
  const loading = transform.pending;
  const selectedModel = useModelFor('notes');
  const { toast } = useToast();
  // The note and its change callback as they are when the reply lands, not as they were when it was asked for.
  const now = useRef({ noteContent, onContentChange });
  now.current = { noteContent, onContentChange };

  useEffect(() => {
    if (!open) return;
    return () => transform.reset(); // closed, or the note is gone
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transform.state.state === 'failed') toast({ variant: 'destructive', title: 'Transform failed', description: transform.state.error });
  }, [transform.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransform = async () => {
    if (!prompt.trim() || loading) return;

    const sent = noteContent;
    const content = await transform.run(async () => (await customTransformStickyNote({
      content: sent,
      prompt: prompt,
    }, selectedModel)).transformedContent, {
      error: (error) => { console.error('Failed to transform note with custom prompt:', error); return "Couldn't transform this note. Try again."; },
    });
    if (content === undefined) return; // it failed, or the dialog closed meanwhile
    if (now.current.noteContent !== sent) {
      toast({ title: "The note changed, so the AI result wasn't applied." });
      return;
    }
    now.current.onContentChange(noteId, { content });
    onOpenChange(false);
    setPrompt('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            Transform Note with AI
          </DialogTitle>
          <DialogDescription>
            Tell the AI how you want to change your note. For example, "translate to Spanish" or "make it more poetic".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 my-4">
            <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Your transformation instruction..."
                className="h-24"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleTransform();
                    }
                }}
            />
            <div className="flex justify-end"><MicButton onText={t => setPrompt(p => appendSpeech(p, t))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleTransform} disabled={loading || !prompt.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transform
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
