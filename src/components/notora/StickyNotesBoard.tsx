'use client';

import { useRef, useMemo } from 'react';
import StickyNote from './StickyNote';
import type { AppData, NoteBoard, StickyNote as StickyNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
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
  
  const createNewNote = (b: NoteBoard): NoteBoard => {
    let newPosition = { x: PADDING, y: PADDING };
    const notesInBoard = b.notes || [];

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
      history: { past: [], present: { title: '', content: '' }, future: [] }
    };

    return { ...b, notes: [...notesInBoard, newNote] };
  };

  const handleAddNote = () => {
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? createNewNote(b) : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };
  
  const handleChange = (noteId: string, newValues: Partial<StickyNoteType> & { undo?: boolean, redo?: boolean }) => {
    const newNoteBoards = data.noteBoards.map(b => {
        if (b.id !== board.id) return b;
        
        const newNotes = b.notes.map(note => {
            if (note.id !== noteId) return note;

            let history = note.history || { past: [], present: { title: note.title || '', content: note.content }, future: [] };
            
            if (newValues.undo) {
                if (history.past.length === 0) return note;
                const previous = history.past[history.past.length - 1];
                const newPast = history.past.slice(0, history.past.length - 1);
                return { 
                    ...note, 
                    title: previous.title, 
                    content: previous.content, 
                    history: { past: newPast, present: previous, future: [history.present, ...history.future] } 
                };
            }

            if (newValues.redo) {
                if (history.future.length === 0) return note;
                const next = history.future[0];
                const newFuture = history.future.slice(1);
                return { 
                    ...note, 
                    title: next.title, 
                    content: next.content, 
                    history: { past: [...history.past, history.present], present: next, future: newFuture } 
                };
            }
            
            const currentState = { title: note.title || '', content: note.content };
            const nextState = { title: newValues.title ?? note.title, content: newValues.content ?? note.content };

            if (currentState.title !== nextState.title || currentState.content !== nextState.content) {
                const newPast = [...history.past, history.present].slice(-10); // Limit history
                history = { past: newPast, present: nextState, future: [] };
            }

            return { ...note, ...newValues, history };
        });
        return { ...b, notes: newNotes };
    });
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };

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
