
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import type { StickyNote } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Save, X, Trash2, Wand2, BookText, List, BrainCircuit, TextCursorInput, RotateCcw, Paintbrush, Loader2 } from 'lucide-react';
import { polishStickyNote } from '@/ai/flows/polish-sticky-note';
import { summarizeStickyNote } from '@/ai/flows/summarize-sticky-note';
import { bulletifyStickyNote } from '@/ai/flows/bullet-ify-sticky-note';
import { simplifyStickyNote } from '@/ai/flows/simplify-sticky-note';
import CustomPromptDialog from './CustomPromptDialog';
import { cn } from '@/lib/utils';

interface FormattedNoteCardProps {
  note: StickyNote;
  noteNumber: number;
  onNoteChange: (id: string, newContent: Partial<StickyNote>) => void;
  onNoteDelete: (id: string) => void;
}

const themeColors: Record<StickyNote['theme'], string> = {
  yellow: 'border-l-4 border-[#FFDA63]',
  blue: 'border-l-4 border-blue-400',
  green: 'border-l-4 border-green-400',
  pink: 'border-l-4 border-pink-400',
  purple: 'border-l-4 border-purple-400',
};

const themes: StickyNote['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];

type AIOperation = 'polish' | 'summarize' | 'bulletify' | 'simplify';

export default function FormattedNoteCard({ note, noteNumber, onNoteChange, onNoteDelete }: FormattedNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);
  const [aiLoading, setAiLoading] = useState<AIOperation | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  const handleSave = () => {
    onNoteChange(note.id, { content: editedContent });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(note.content);
    setIsEditing(false);
  };
  
  const handleAIAction = async (operation: AIOperation) => {
    setAiLoading(operation);
    setPreviousContent(note.content);
    try {
        let result;
        switch (operation) {
            case 'polish':
                result = await polishStickyNote({ content: note.content });
                onNoteChange(note.id, { content: result.polishedContent });
                break;
            case 'summarize':
                result = await summarizeStickyNote({ content: note.content });
                onNoteChange(note.id, { content: result.summary });
                break;
            case 'bulletify':
                result = await bulletifyStickyNote({ text: note.content });
                onNoteChange(note.id, { content: result.bulletifiedText });
                break;
            case 'simplify':
                result = await simplifyStickyNote({ text: note.content });
                onNoteChange(note.id, { content: result.simplifiedText });
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
      onNoteChange(note.id, { content: previousContent });
      setPreviousContent(null);
    }
  };
  
  const handleCustomPrompt = () => {
    setPreviousContent(note.content);
    setIsPromptDialogOpen(true);
  }

  return (
    <>
      <Card className={cn("dark:bg-card/50 transition-all", themeColors[note.theme])}>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-semibold">Note {noteNumber}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAIAction('polish')} disabled={!!aiLoading}>
                {aiLoading === 'polish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Polish This
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAIAction('summarize')} disabled={!!aiLoading}>
                {aiLoading === 'summarize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookText className="mr-2 h-4 w-4" />} Summarize
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
                  <RotateCcw className="mr-2 h-4 w-4" /> Undo AI Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Paintbrush className="mr-2 h-4 w-4" /> Change Color
                <div className='flex gap-1 ml-auto'>
                    {themes.map(theme => (
                        <button key={theme} onClick={(e) => {
                            e.stopPropagation();
                            onNoteChange(note.id, { theme });
                        }} className={`w-4 h-4 rounded-full ${cn(themeColors[theme].replace('border-l-4 ','bg-[').replace(']','/30]'))}`} />
                    ))}
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNoteDelete(note.id)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="h-32"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          ) : (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
      
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
        onContentChange={onNoteChange}
      />
    </>
  );
}
