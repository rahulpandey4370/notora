'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import type { StickyNote as StickyNoteType } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Wand2, BookText, List, BrainCircuit, Loader2 } from 'lucide-react';
import { polishStickyNote } from '@/ai/flows/polish-sticky-note';
import { summarizeStickyNote } from '@/ai/flows/summarize-sticky-note';
import { bulletifyStickyNote } from '@/ai/flows/bullet-ify-sticky-note';
import { simplifyStickyNote } from '@/ai/flows/simplify-sticky-note';

interface StickyNoteProps {
  note: StickyNoteType;
  onChange: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  onStopDrag: (id: string, position: { x: number; y: number }) => void;
  constraintsRef: React.RefObject<HTMLDivElement>;
}

const themeColors = {
  yellow: 'bg-[#FFDA63]/30 border-[#FFDA63]',
  blue: 'bg-blue-300/30 border-blue-400',
  green: 'bg-green-300/30 border-green-400',
  pink: 'bg-pink-300/30 border-pink-400',
  purple: 'bg-purple-300/30 border-purple-400',
};

type AIOperation = 'polish' | 'summarize' | 'bulletify' | 'simplify';

export default function StickyNote({ note, onChange, onDelete, onStopDrag, constraintsRef }: StickyNoteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [aiLoading, setAiLoading] = useState<AIOperation | null>(null);
  const x = useMotionValue(note.position.x);
  const y = useMotionValue(note.position.y);
  const dragControls = useDragControls();

  const handleAIAction = async (operation: AIOperation) => {
    setAiLoading(operation);
    try {
        let result;
        switch (operation) {
            case 'polish':
                result = await polishStickyNote({ content: note.content });
                onChange(note.id, result.polishedContent);
                break;
            case 'summarize':
                result = await summarizeStickyNote({ content: note.content });
                onChange(note.id, result.summary);
                break;
            case 'bulletify':
                result = await bulletifyStickyNote({ text: note.content });
                onChange(note.id, result.bulletifiedText);
                break;
            case 'simplify':
                result = await simplifyStickyNote({ text: note.content });
                onChange(note.id, result.simplifiedText);
                break;
        }
    } catch (error) {
        console.error(`Failed to ${operation} note:`, error);
        // Optionally show a toast to the user
    } finally {
        setAiLoading(null);
    }
  };


  return (
    <motion.div
      drag
      dragListener={false}
      onPointerDown={(e) => {
        if (e.target instanceof HTMLTextAreaElement) return;
        dragControls.start(e)
      }}
      dragControls={dragControls}
      dragConstraints={constraintsRef}
      whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0px 10px 30px rgba(0,0,0,0.2)" }}
      onDragEnd={() => onStopDrag(note.id, { x: x.get(), y: y.get() })}
      style={{ x, y }}
      className={`absolute w-64 h-64 p-4 rounded-lg shadow-md border ${themeColors[note.theme] || themeColors.yellow} flex flex-col cursor-grab active:cursor-grabbing`}
    >
      <Textarea
        value={note.content}
        onChange={(e) => onChange(note.id, e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full h-full bg-transparent border-0 focus-visible:ring-0 resize-none text-sm"
        placeholder="What's on your mind?"
      />
      <div className="absolute bottom-2 right-2">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAIAction('polish')} disabled={!!aiLoading}>
                    {aiLoading === 'polish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Polish This
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIAction('summarize')} disabled={!!aiLoading}>
                    {aiLoading === 'summarize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookText className="mr-2 h-4 w-4" />} Summarize This
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIAction('bulletify')} disabled={!!aiLoading}>
                    {aiLoading === 'bulletify' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />} Bullet-ify
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIAction('simplify')} disabled={!!aiLoading}>
                    {aiLoading === 'simplify' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />} Simplify
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
