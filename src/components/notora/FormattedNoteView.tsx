
'use client';

import { createRef, useEffect } from 'react';
import type { AppData, NoteBoard, StickyNote } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import FormattedNoteCard from './FormattedNoteCard';
import { motion } from 'framer-motion';

interface FormattedNoteViewProps {
  board: NoteBoard;
  data: AppData;
  onDataChange: (data: AppData) => void;
  noteToFocus?: string | null;
  onFocusHandled?: () => void;
}

export default function FormattedNoteView({ board, data, onDataChange, noteToFocus, onFocusHandled }: FormattedNoteViewProps) {
  const notes = board.notes || [];
  const noteRefs = notes.reduce((acc, note) => {
    acc[note.id] = createRef<HTMLDivElement>();
    return acc;
  }, {} as Record<string, React.RefObject<HTMLDivElement>>);

  useEffect(() => {
    if (noteToFocus && noteRefs[noteToFocus]?.current) {
        noteRefs[noteToFocus].current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
        // Reset focus after scrolling
        if (onFocusHandled) {
            onFocusHandled();
        }
    }
  }, [noteToFocus, noteRefs, onFocusHandled]);

  const handleNoteChange = (noteId: string, newContent: Partial<StickyNote>) => {
    const newNoteBoards = data.noteBoards.map(b =>
      b.id === board.id
        ? { ...b, notes: b.notes.map(note => (note.id === noteId ? { ...note, ...newContent } : note)) }
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };
  
  const handleNoteDelete = (noteId: string) => {
    const newNoteBoards = data.noteBoards.map(b =>
        b.id === board.id
        ? { ...b, notes: b.notes.filter(note => note.id !== noteId) }
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <ScrollArea className="h-[70vh] pr-4">
      <motion.div 
        className="space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {notes.length > 0 ? (
          notes.map((note, index) => (
            <motion.div key={note.id} variants={itemVariants}>
                <FormattedNoteCard 
                    note={note}
                    noteNumber={index + 1}
                    onNoteChange={handleNoteChange}
                    onNoteDelete={handleNoteDelete}
                    scrollRef={noteRefs[note.id]}
                />
            </motion.div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground pt-10">
            <p>This board has no notes yet.</p>
          </div>
        )}
      </motion.div>
    </ScrollArea>
  );
}
