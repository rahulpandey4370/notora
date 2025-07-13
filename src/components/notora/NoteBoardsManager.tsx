'use client';

import { useState } from 'react';
import type { AppData, NoteBoard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StickyNotesBoard from './StickyNotesBoard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface NoteBoardsManagerProps {
  noteBoards: NoteBoard[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function NoteBoardsManager({ noteBoards, data, onDataChange }: NoteBoardsManagerProps) {
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [editingBoard, setEditingBoard] = useState<{ id: string, title: string } | null>(null);

  const handleAddBoard = () => {
    if (newBoardTitle.trim() === '') return;

    const newBoard: NoteBoard = {
      id: uuidv4(),
      title: newBoardTitle.trim(),
      notes: [],
    };

    onDataChange({ ...data, noteBoards: [...data.noteBoards, newBoard] });
    setNewBoardTitle('');
  };

  const handleDeleteBoard = (boardId: string) => {
    const newNoteBoards = data.noteBoards.filter(b => b.id !== boardId);
    onDataChange({ ...data, noteBoards: newNoteBoards });
  };
  
  const handleStartEdit = (board: NoteBoard) => {
    setEditingBoard({ id: board.id, title: board.title });
  }

  const handleConfirmEdit = () => {
    if (!editingBoard || editingBoard.title.trim() === '') return;
    const newNoteBoards = data.noteBoards.map(b => 
      b.id === editingBoard.id ? { ...b, title: editingBoard.title.trim() } : b
    );
    onDataChange({ ...data, noteBoards: newNoteBoards });
    setEditingBoard(null);
  }

  const handleCancelEdit = () => {
    setEditingBoard(null);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
       <div className="flex flex-col sm:flex-row items-center gap-2">
            <Input
            placeholder="New board title..."
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBoard()}
            className="w-full sm:w-auto"
            />
            <Button onClick={handleAddBoard} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Board
            </Button>
      </div>

      <Tabs defaultValue={noteBoards[0]?.id || ''} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
            <TabsList>
            {noteBoards.map(board => (
                <div key={board.id} className="relative group flex-shrink-0">
                {editingBoard?.id === board.id ? (
                    <div className='flex items-center gap-1 p-1'>
                    <Input 
                        value={editingBoard.title}
                        onChange={(e) => setEditingBoard({...editingBoard, title: e.target.value})}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="h-8 w-32"
                        autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleConfirmEdit}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}><X className="h-4 w-4" /></Button>
                    </div>
                ) : (
                  <div className='relative'>
                    <TabsTrigger value={board.id} className="pr-10">
                        {board.title}
                    </TabsTrigger>
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-muted rounded-md">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(board)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your note board and all the notes within it.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteBoard(board.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </div>
                )}
                </div>
            ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {noteBoards.map(board => (
            <TabsContent value={board.id} key={board.id}>
                <StickyNotesBoard board={board} data={data} onDataChange={onDataChange} />
            </TabsContent>
        ))}
      </Tabs>
      {noteBoards.length === 0 && <p className='text-center text-muted-foreground pt-10'>Create a board to start organizing your notes!</p>}
    </div>
  );
}
