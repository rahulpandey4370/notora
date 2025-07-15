
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
const NOTE_WIDTH = 256;
const NOTE_HEIGHT = 256;
const HORIZONTAL_OFFSET = 32;
const VERTICAL_OFFSET = 32;
const PADDING = 20;

export default function StickyNotesBoard({ board, data, onDataChange }: StickyNotesBoardProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);

  const boardHeight = useMemo(() => {
    if (!board.notes || board.notes.length === 0) {
      return 500; // default height
    }
    const maxY = Math.max(...board.notes.map(note => note.position.y + (note.height || NOTE_HEIGHT)));
    return Math.max(500, maxY + PADDING);
  }, [board.notes]);

  const handleAddNote = () => {
    const boardWidth = constraintsRef.current?.offsetWidth ?? window.innerWidth;
    let newPosition = { x: PADDING, y: PADDING };

    if (board.notes.length > 0) {
        const lastNote = board.notes[board.notes.length - 1];
        let nextX = lastNote.position.x + (lastNote.width || NOTE_WIDTH) + HORIZONTAL_OFFSET;

        if (nextX + NOTE_WIDTH > boardWidth) {
            // Wrap to a new row
            newPosition.x = PADDING;
            const columnTops = [PADDING];
            board.notes.forEach(note => {
                for(let i=0; i < columnTops.length; i++) {
                    if (note.position.x === PADDING) {
                        columnTops[i] = Math.max(columnTops[i], note.position.y + (note.height || NOTE_HEIGHT) + VERTICAL_OFFSET);
                    }
                }
            });
            newPosition.y = Math.min(...columnTops);
        } else {
            // Place on the same row
            newPosition.x = nextX;
            newPosition.y = lastNote.position.y;
        }
    }

    const newNote: StickyNoteType = {
      id: uuidv4(),
      content: '',
      position: newPosition,
      theme: themes[board.notes.length % themes.length],
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
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
  
  const handleStopResize = (noteId: string, size: { width: number; height: number }) => {
    const newNoteBoards = data.noteBoards.map(b => 
        b.id === board.id 
        ? { ...b, notes: b.notes.map(note => note.id === noteId ? {...note, width: size.width, height: size.height} : note) } 
        : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };


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
      {board.notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground">Add a note to this board to get started!</p>
        </div>
      )}
    </div>
  );
}
