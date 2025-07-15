'use client';

import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  const handleTransform = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const result = await customTransformStickyNote({
        content: noteContent,
        prompt: prompt,
      });
      onContentChange(noteId, { content: result.transformedContent });
      onOpenChange(false);
      setPrompt('');
    } catch (error) {
      console.error('Failed to transform note with custom prompt:', error);
      // You could show a toast here for the error
    } finally {
      setLoading(false);
    }
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
