'use client';

import { useRef, useMemo, useCallback, useEffect } from 'react';
import StickyNote from './StickyNote';
import type { AppData, NoteBoard, StickyNote as StickyNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { generateNoteTitle } from '@/ai/flows/generate-note-title';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StickyNotesBoardProps {
  board: NoteBoard;
  data: AppData;
  onDataChange: (data: AppData) => void;
  onSwitchView: (noteId: string) => void;
}

const themes: StickyNoteType['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];
const NOTE_WIDTH = 256;
const NOTE_HEIGHT = 256;
const PADDING = 24;

export default function StickyNotesBoard({ board, data, onDataChange, onSwitchView }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const titleGenerationTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  const boardDimensions = useMemo(() => {
    if (isMobile || !board.notes || board.notes.length === 0) {
      return { width: '100%', height: 'auto' };
    }
    const maxX = Math.max(...board.notes.map(note => note.position.x + NOTE_WIDTH));
    const maxY = Math.max(...board.notes.map(note => note.position.y + NOTE_HEIGHT));
    
    const containerWidth = constraintsRef.current?.parentElement?.clientWidth || 0;

    return { 
      width: Math.max(containerWidth, maxX + PADDING),
      height: Math.max(500, maxY + PADDING)
    };
  }, [board.notes, isMobile]);

  const handleAddNote = () => {
    let newPosition = { x: PADDING, y: PADDING };
    const notesInBoard = board.notes || [];

    if (notesInBoard.length > 0 && !isMobile) {
      const maxY = Math.max(...notesInBoard.map(n => n.position.y));
      const rightMostNoteOnBottomRow = notesInBoard
        .filter(n => n.position.y === maxY)
        .reduce((prev, current) => (prev.position.x > current.position.x) ? prev : current);

      const boardWidth = constraintsRef.current?.clientWidth || window.innerWidth;

      if (rightMostNoteOnBottomRow.position.x + NOTE_WIDTH * 2 + PADDING > boardWidth) {
        newPosition = { x: PADDING, y: maxY + NOTE_HEIGHT + PADDING };
      } else {
        newPosition = { x: rightMostNoteOnBottomRow.position.x + NOTE_WIDTH + PADDING, y: maxY };
      }
    }

    const newNote: StickyNoteType = {
      id: uuidv4(),
      title: '',
      content: '',
      position: newPosition,
      theme: themes[notesInBoard.length % themes.length],
    };
    
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? { ...b, notes: [...notesInBoard, newNote] } : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };
  
  const generateTitleForNote = useCallback(async (noteId: string, content: string) => {
    try {
        const result = await generateNoteTitle({ content });
        if (result.title) {
           const newNoteBoards = data.noteBoards.map(b =>
            b.id === board.id
              ? {
                  ...b,
                  notes: b.notes.map(note =>
                    note.id === noteId ? { ...note, title: result.title } : note
                  ),
                }
              : b
          );
          onDataChange({ ...data, noteBoards: newNoteBoards });
        }
    } catch (error) {
        console.error("Failed to generate title:", error);
    }
  }, [data, board.id, onDataChange]);

  const handleChange = (noteId: string, newValues: Partial<StickyNoteType>) => {
    const isContentChange = 'content' in newValues;
    const noteToUpdate = board.notes.find(n => n.id === noteId);

    if (!noteToUpdate) return;
    
    const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, ...newValues} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
    
    if (isContentChange && newValues.content && !noteToUpdate.title) {
      if (titleGenerationTimeout.current) {
        clearTimeout(titleGenerationTimeout.current);
      }
      titleGenerationTimeout.current = setTimeout(() => {
        generateTitleForNote(noteId, newValues.content!);
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (titleGenerationTimeout.current) {
        clearTimeout(titleGenerationTimeout.current);
      }
    };
  }, []);

  const handleDelete = (noteId: string) => {
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? { ...b, notes: b.notes.filter(note => note.id !== noteId) } : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };

  const handleStopDrag = (noteId: string, position: { x: number, y: number }) => {
     if (isMobile) return;
     const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, position} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  }

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

  if (isMobile) {
    return (
      <div className="space-y-4">
        <Button onClick={handleAddNote} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Note
        </Button>
        <motion.div 
            className="space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
          {(board.notes || []).map((note) => (
            <motion.div key={note.id} variants={itemVariants}>
              <StickyNote
                key={note.id}
                note={note}
                onChange={handleChange}
                onDelete={handleDelete}
                onStopDrag={handleStopDrag}
                constraintsRef={constraintsRef}
                onSwitchView={onSwitchView}
                isMobile={isMobile}
              />
            </motion.div>
          ))}
        </motion.div>
        {(board.notes || []).length === 0 && (
          <div className="flex items-center justify-center pointer-events-none py-10">
            <p className="text-muted-foreground">Add a note to get started!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full h-[60vh] md:h-[70vh] rounded-md border-2 border-dashed bg-secondary/50">
        <div 
            className="relative transition-all duration-300" 
            ref={constraintsRef}
            style={{ 
                width: `${boardDimensions.width}px`, 
                height: `${boardDimensions.height}px`,
                minHeight: '100%',
                minWidth: '100%',
            }}
        >
          <Button
              onClick={handleAddNote}
              variant="outline"
              className="absolute top-4 right-4 z-30"
          >
              <Plus className="mr-2 h-4 w-4" /> Add Note
          </Button>
          {(board.notes || []).map((note) => (
              <StickyNote
                  key={note.id}
                  note={note}
                  onChange={handleChange}
                  onDelete={handleDelete}
                  onStopDrag={handleStopDrag}
                  constraintsRef={constraintsRef}
                  onSwitchView={onSwitchView}
                  isMobile={isMobile}
              />
          ))}
          {(board.notes || []).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground">Add a note to this board to get started!</p>
              </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
