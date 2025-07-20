'use client';

import { useRef, useMemo } from 'react';
import StickyNote from './StickyNote';
import type { AppData, NoteBoard, StickyNote as StickyNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface StickyNotesBoardProps {
  board: NoteBoard;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

const themes: StickyNoteType['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];
const NOTE_WIDTH = 256;
const NOTE_HEIGHT = 256;
const PADDING = 24; // Added padding

export default function StickyNotesBoard({ board, data, onDataChange }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  const boardDimensions = useMemo(() => {
    if (!board.notes || board.notes.length === 0) {
      return { width: '100%', height: 500 };
    }
    const maxX = Math.max(...board.notes.map(note => note.position.x + (note.width || NOTE_WIDTH)));
    const maxY = Math.max(...board.notes.map(note => note.position.y + (note.height || NOTE_HEIGHT)));
    
    // Ensure the board is at least the size of the container, or larger if notes overflow
    const containerWidth = constraintsRef.current?.parentElement?.clientWidth || 0;

    return { 
      width: Math.max(containerWidth, maxX + PADDING),
      height: maxY + PADDING 
    };
  }, [board.notes, constraintsRef.current]);

  const handleAddNote = () => {
    const boardWidth = constraintsRef.current?.offsetWidth ?? window.innerWidth;
    let newPosition = { x: PADDING, y: PADDING };
    const notesInBoard = board.notes || [];

    if (notesInBoard.length > 0) {
      // Find the highest Y position of any note on the board
      const maxY = Math.max(...notesInBoard.map(n => n.position.y + (n.height || NOTE_HEIGHT)));
      newPosition = { x: PADDING, y: maxY + PADDING };
    }


    const newNote: StickyNoteType = {
      id: uuidv4(),
      content: '',
      position: newPosition,
      theme: themes[notesInBoard.length % themes.length],
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
    };
    
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? { ...b, notes: [...notesInBoard, newNote] } : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };

  const handleChange = (noteId: string, newContent: Partial<StickyNoteType>) => {
    const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, ...newContent} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };

  const handleDelete = (noteId: string) => {
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? { ...b, notes: b.notes.filter(note => note.id !== noteId) } : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };

  const handleStopDrag = (noteId: string, position: { x: number, y: number }) => {
     const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, position} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  }
  
  const handleStopResize = (noteId: string, size: { width: number; height: number }) => {
    const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, width: size.width, height: size.height} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };


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
        {(board.notes || []).map((note) => (
            <StickyNote
                key={note.id}
                note={note}
                onChange={handleChange}
                onDelete={handleDelete}
                onStopDrag={handleStopDrag}
                onStopResize={handleStopResize}
                constraintsRef={constraintsRef}
            />
        ))}
        <Button
            onClick={handleAddNote}
            variant="outline"
            className="absolute top-4 right-4 z-30"
        >
            <Plus className="mr-2 h-4 w-4" /> Add Note
        </Button>
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