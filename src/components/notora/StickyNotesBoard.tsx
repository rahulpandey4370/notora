'use client';

import { useRef } from 'react';
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

export default function StickyNotesBoard({ board, data, onDataChange }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleAddNote = () => {
    const newNote: StickyNoteType = {
      id: uuidv4(),
      content: '',
      position: { x: 20, y: 20 },
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
    <div className="relative min-h-[500px] w-full rounded-md border-2 border-dashed bg-secondary/50 p-4" ref={constraintsRef}>
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
