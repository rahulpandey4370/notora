'use client';

import { useState } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import type { StickyNote as StickyNoteType } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Wand2, BookText, List, BrainCircuit, Loader2, Paintbrush, TextCursorInput, RotateCcw, Newspaper } from 'lucide-react';
import { polishStickyNote } from '@/ai/flows/polish-sticky-note';
import { summarizeStickyNote } from '@/ai/flows/summarize-sticky-note';
import { bulletifyStickyNote } from '@/ai/flows/bullet-ify-sticky-note';
import { simplifyStickyNote } from '@/ai/flows/simplify-sticky-note';
import CustomPromptDialog from './CustomPromptDialog';

interface StickyNoteProps {
  note: StickyNoteType;
  onChange: (id: string, newContent: Partial<StickyNoteType>) => void;
  onDelete: (id: string) => void;
  onStopDrag: (id: string, position: { x: number; y: number }) => void;
  constraintsRef: React.RefObject<HTMLDivElement>;
  onSwitchView: (noteId: string) => void;
}

const themeColors: Record<StickyNoteType['theme'], string> = {
  yellow: 'bg-[#FFDA63]/30 border-[#FFDA63]',
  blue: 'bg-blue-300/30 border-blue-400',
  green: 'bg-green-300/30 border-green-400',
  pink: 'bg-pink-300/30 border-pink-400',
  purple: 'bg-purple-300/30 border-purple-400',
};

const themes: StickyNoteType['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];

type AIOperation = 'polish' | 'summarize' | 'bulletify' | 'simplify';

const NOTE_SIZE = 256;

export default function StickyNote({ note, onChange, onDelete, onStopDrag, constraintsRef, onSwitchView }: StickyNoteProps) {
  const [aiLoading, setAiLoading] = useState<AIOperation | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  const x = useMotionValue(note.position.x);
  const y = useMotionValue(note.position.y);
  const dragControls = useDragControls();

  const handleAIAction = async (operation: AIOperation) => {
    setAiLoading(operation);
    setPreviousContent(note.content);
    try {
        let result;
        switch (operation) {
            case 'polish':
                result = await polishStickyNote({ content: note.content });
                onChange(note.id, { content: result.polishedContent });
                break;
            case 'summarize':
                result = await summarizeStickyNote({ content: note.content });
                onChange(note.id, { content: result.summary });
                break;
            case 'bulletify':
                result = await bulletifyStickyNote({ text: note.content });
                onChange(note.id, { content: result.bulletifiedText });
                break;
            case 'simplify':
                result = await simplifyStickyNote({ text: note.content });
                onChange(note.id, { content: result.simplifiedText });
                break;
        }
    } catch (error) {
        console.error(`Failed to ${operation} note:`, error);
        setPreviousContent(null); // Clear previous content on error
    } finally {
        setAiLoading(null);
    }
  };

  const handleUndo = () => {
    if (previousContent !== null) {
      onChange(note.id, { content: previousContent });
      setPreviousContent(null);
    }
  };
  
  const handleCustomPrompt = () => {
    setPreviousContent(note.content);
    setIsPromptDialogOpen(true);
  }

  return (
    <>
      <motion.div
        drag
        dragListener={false}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.resize-handle') || target.closest('button') || target instanceof HTMLTextAreaElement) {
              return;
          }
          dragControls.start(e)
        }}
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0px 10px 30px rgba(0,0,0,0.2)" }}
        onDragEnd={() => onStopDrag(note.id, { x: x.get(), y: y.get() })}
        style={{ x, y, width: NOTE_SIZE, height: NOTE_SIZE }}
        className={`absolute p-4 rounded-lg shadow-md border ${themeColors[note.theme] || themeColors.yellow} flex flex-col cursor-grab active:cursor-grabbing overflow-hidden`}
      >
        <Textarea
          value={note.content}
          onChange={(e) => onChange(note.id, { content: e.target.value })}
          className="w-full h-full bg-transparent border-0 focus-visible:ring-0 resize-none text-sm overflow-y-auto"
          placeholder="What's on your mind?"
        />
        <div className="absolute bottom-2 right-2 flex items-center">
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <MoreVertical className="h-4 w-4" />
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSwitchView(note.id)}>
                      <Newspaper className="mr-2 h-4 w-4" /> View in Formatted Mode
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAIAction('polish')} disabled={!!aiLoading}>
                      {aiLoading === 'polish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Polish This
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAIAction('summarize')} disabled={!!aiLoading}>
                      {aiLoading === 'summarize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookText className="mr-2 h-4 w-4" />} Summarize This
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={handleCustomPrompt} disabled={!!aiLoading}>
                      <TextCursorInput className="mr-2 h-4 w-4" /> Transform...
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAIAction('bulletify')} disabled={!!aiLoading}>
                      {aiLoading === 'bulletify' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />} Bullet-ify
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAIAction('simplify')} disabled={!!aiLoading}>
                      {aiLoading === 'simplify' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />} Simplify
                  </DropdownMenuItem>
                  {previousContent !== null && (
                    <DropdownMenuItem onClick={handleUndo}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Undo
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                   <DropdownMenuItem>
                      <Paintbrush className="mr-2 h-4 w-4" /> Change Color
                      <div className='flex gap-1 ml-auto'>
                          {themes.map(theme => (
                              <button key={theme} onClick={(e) => {
                                  e.stopPropagation();
                                  onChange(note.id, { theme });
                              }} className={`w-4 h-4 rounded-full ${themeColors[theme].split(' ')[0]}`} />
                          ))}
                      </div>
                   </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </motion.div>
      <CustomPromptDialog
        open={isPromptDialogOpen}
        onOpenChange={(isOpen) => {
            setIsPromptDialogOpen(isOpen);
            if (!isOpen) {
              setPreviousContent(null);
            }
        }}
        noteContent={note.content}
        noteId={note.id}
        onContentChange={onChange}
      />
    </>
  );
}
