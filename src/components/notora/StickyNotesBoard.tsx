
'use client';

import { useRef, useMemo } from 'react';
import StickyNote from './StickyNote';
import type { AppData, NoteBoard, StickyNote as StickyNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface StickyNotesBoardProps {
  board: NoteBoard;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

const themes: StickyNoteType['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];
const NOTE_WIDTH = 256; // w-64
const NOTE_HEIGHT = 256; // h-64
const NOTE_OFFSET_X = 40;
const NOTE_OFFSET_Y = 40;
const PADDING = 20;

export default function StickyNotesBoard({ board, data, onDataChange }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  const boardHeight = useMemo(() => {
    if (!board.notes || board.notes.length === 0) {
      return 500; // default height
    }
    const maxY = Math.max(...board.notes.map(note => note.position.y + NOTE_HEIGHT));
    return Math.max(500, maxY + PADDING);
  }, [board.notes]);

  const handleAddNote = () => {
    let newPosition = { x: PADDING, y: PADDING };

    if (board.notes.length > 0) {
        const lastNote = board.notes[board.notes.length - 1];
        const boardWidth = constraintsRef.current ? constraintsRef.current.offsetWidth : Infinity;
        
        // Try placing it to the right of the last note
        let potentialX = lastNote.position.x + NOTE_WIDTH + NOTE_OFFSET_X;

        // If it goes off-screen, wrap to a new "row"
        if (potentialX + NOTE_WIDTH > boardWidth) {
            newPosition.x = PADDING;
            // Place it below the highest note on the board
            const maxY = Math.max(...board.notes.map(n => n.position.y));
            newPosition.y = maxY + NOTE_HEIGHT + NOTE_OFFSET_Y;
        } else {
            // Otherwise, place it next to the last note
            newPosition.x = potentialX - NOTE_WIDTH; // a bit of an offset from previous note
            newPosition.y = lastNote.position.y;
        }

    }

    const newNote: StickyNoteType = {
      id: uuidv4(),
      content: '',
      position: newPosition,
      theme: themes[board.notes.length % themes.length],
    };
    
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === board.id ? { ...b, notes: [...b.notes, newNote] } : b
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

  return (
    <div 
      className="relative w-full rounded-md border-2 border-dashed bg-secondary/50 p-4 transition-all duration-300" 
      ref={constraintsRef}
      style={{ minHeight: `${boardHeight}px` }}
    >
      {board.notes.map((note) => (
        <StickyNote
          key={note.id}
          note={note}
          onChange={handleChange}
          onDelete={handleDelete}
          onStopDrag={handleStopDrag}
          constraintsRef={constraintsRef}
        />
      ))}
      <Button
        onClick={handleAddNote}
        variant="outline"
        className="absolute top-4 right-4 z-10"
      >
        <Plus className="mr-2 h-4 w-4" /> Add Note
      </Button>
      {board.notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground">Add a note to this board to get started!</p>
        </div>
      )}
    </div>
  );
}
