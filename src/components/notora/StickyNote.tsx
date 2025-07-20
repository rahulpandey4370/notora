'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import type { StickyNote as StickyNoteType } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Wand2, BookText, List, BrainCircuit, Loader2, Paintbrush, TextCursorInput, RotateCcw, Newspaper, Save, X } from 'lucide-react';
import { polishStickyNote } from '@/ai/flows/polish-sticky-note';
import { summarizeStickyNote } from '@/ai/flows/summarize-sticky-note';
import { bulletifyStickyNote } from '@/ai/flows/bullet-ify-sticky-note';
import { simplifyStickyNote } from '@/ai/flows/simplify-sticky-note';
import CustomPromptDialog from './CustomPromptDialog';
import ReactMarkdown from 'react-markdown';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

interface StickyNoteProps {
  note: StickyNoteType;
  onChange: (id: string, newContent: Partial<StickyNoteType>) => void;
  onDelete: (id: string) => void;
  onStopDrag: (id: string, position: { x: number; y: number }) => void;
  constraintsRef: React.RefObject<HTMLDivElement>;
  onSwitchView: (noteId: string) => void;
  isMobile?: boolean;
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

export default function StickyNote({ note, onChange, onDelete, onStopDrag, constraintsRef, onSwitchView, isMobile = false }: StickyNoteProps) {
  const [aiLoading, setAiLoading] = useState<AIOperation | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);
  const [editedTitle, setEditedTitle] = useState(note.title || '');


  const x = useMotionValue(note.position.x);
  const y = useMotionValue(note.position.y);
  const dragControls = useDragControls();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedContent]);
  
  const handleAIAction = async (operation: AIOperation) => {
    setAiLoading(operation);
    setPreviousContent(note.content);
    try {
        let result;
        const contentToProcess = isEditing ? editedContent : note.content;
        switch (operation) {
            case 'polish':
                result = await polishStickyNote({ content: contentToProcess });
                onChange(note.id, { content: result.polishedContent });
                if(isEditing) setEditedContent(result.polishedContent);
                break;
            case 'summarize':
                result = await summarizeStickyNote({ content: contentToProcess });
                onChange(note.id, { content: result.summary });
                if(isEditing) setEditedContent(result.summary);
                break;
            case 'bulletify':
                result = await bulletifyStickyNote({ text: contentToProcess });
                onChange(note.id, { content: result.bulletifiedText });
                if(isEditing) setEditedContent(result.bulletifiedText);
                break;
            case 'simplify':
                result = await simplifyStickyNote({ text: contentToProcess });
                onChange(note.id, { content: result.simplifiedText });
                if(isEditing) setEditedContent(result.simplifiedText);
                break;
        }
    } catch (error) {
        console.error(`Failed to ${operation} note:`, error);
        setPreviousContent(null);
    } finally {
        setAiLoading(null);
    }
  };

  const handleUndo = () => {
    if (previousContent !== null) {
      onChange(note.id, { content: previousContent });
      if (isEditing) setEditedContent(previousContent);
      setPreviousContent(null);
    }
  };
  
  const handleCustomPrompt = () => {
    setPreviousContent(note.content);
    setIsPromptDialogOpen(true);
  };
  
  const handleStartEditing = () => {
    if (isEditing) return;
    setEditedTitle(note.title || '');
    setEditedContent(note.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    onChange(note.id, { title: editedTitle, content: editedContent });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(note.title || '');
    setEditedContent(note.content);
    setIsEditing(false);
  };
  
  const noteComponent = (
      <div
        className={cn(
            `rounded-lg shadow-md border ${themeColors[note.theme] || themeColors.yellow} flex flex-col cursor-default overflow-hidden`,
            isMobile ? 'w-full h-auto min-h-[256px]' : 'absolute',
        )}
        style={isMobile ? {} : { width: NOTE_SIZE, height: 'auto' }}
        onClick={handleStartEditing}
      >
        <div 
          className="note-header p-2 pb-0 flex-shrink-0 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
              if (isMobile || isEditing) return;
              e.preventDefault();
              dragControls.start(e);
          }}
          onDoubleClick={handleStartEditing}
        >
          {isEditing ? (
             <Input 
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Note title..."
                className="font-bold text-sm border-0 border-b rounded-none px-1 h-8 focus-visible:ring-0 bg-transparent"
              />
          ): (
            <h3 className="font-bold text-sm p-1 truncate">{note.title || 'Note'}</h3>
          )}
        </div>

        <div 
          className="px-4 pt-1 pb-1 flex-grow flex flex-col min-h-0"
        >
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="w-full h-full bg-transparent border-0 focus-visible:ring-0 resize-none text-sm p-0 overflow-y-auto"
              placeholder="What's on your mind?"
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none flex-grow overflow-y-auto pr-2 h-36">
              <ReactMarkdown>{note.content || "Click to start typing..."}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-2 py-1 flex-shrink-0 mt-auto" onClick={e => e.stopPropagation()}>
            {isEditing && (
                <div className="flex-1 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleSave}><Save className="h-4 w-4 text-green-600" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleCancel}><X className="h-4 w-4 text-red-600" /></Button>
                </div>
            )}
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
      </div>
  );

  return (
    <>
      {isMobile ? noteComponent : (
        <motion.div
            drag
            dragControls={dragControls}
            dragConstraints={constraintsRef}
            whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0px 10px 30px rgba(0,0,0,0.2)" }}
            onDragEnd={() => onStopDrag(note.id, { x: x.get(), y: y.get() })}
            style={{ x, y, width: NOTE_SIZE, height: 'auto' }}
            className="absolute cursor-default"
        >
            {noteComponent}
        </motion.div>
      )}

      <CustomPromptDialog
        open={isPromptDialogOpen}
        onOpenChange={(isOpen) => {
            setIsPromptDialogOpen(isOpen);
            if (!isOpen) {
              setPreviousContent(null);
            }
        }}
        noteContent={isEditing ? editedContent : note.content}
        noteId={note.id}
        onContentChange={(id, newContent) => {
          onChange(id, newContent);
          if (isEditing && newContent.content) {
            setEditedContent(newContent.content);
          }
        }}
      />
    </>
  );
}