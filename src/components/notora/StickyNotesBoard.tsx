'use client';

import { useRef } from 'react';
import StickyNote from './StickyNote';
import type { AppData, StickyNote as StickyNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface StickyNotesBoardProps {
  notes: StickyNoteType[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

const themes: StickyNoteType['theme'][] = ['yellow', 'blue', 'green', 'pink', 'purple'];

export default function StickyNotesBoard({ notes, data, onDataChange }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleAddNote = () => {
    const newNote: StickyNoteType = {
      id: uuidv4(),
      content: '',
      position: { x: 20, y: 20 },
      theme: themes[notes.length % themes.length],
    };
    onDataChange({ ...data, notes: [...notes, newNote] });
  };

  const handleChange = (id: string, newContent: string) => {
    const newNotes = notes.map((note) =>
      note.id === id ? { ...note, content: newContent } : note
    );
    onDataChange({ ...data, notes: newNotes });
  };

  const handleDelete = (id: string) => {
    const newNotes = notes.filter((note) => note.id !== id);
    onDataChange({ ...data, notes: newNotes });
  };

  const handleStopDrag = (id: string, position: { x: number, y: number }) => {
     const newNotes = notes.map((note) =>
        note.id === id ? { ...note, position } : note
    );
    onDataChange({ ...data, notes: newNotes });
  }

  return (
    <div className="relative h-[500px] w-full rounded-md border-2 border-dashed bg-secondary/50" ref={constraintsRef}>
      {notes.map((note) => (
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
      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground">Add a note to get started!</p>
        </div>
      )}
    </div>
  );
}
