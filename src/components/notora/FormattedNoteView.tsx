'use client';

import ReactMarkdown from 'react-markdown';
import type { AppData, NoteBoard, StickyNote } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';

interface FormattedNoteViewProps {
  board: NoteBoard;
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function FormattedNoteView({ board, data, onDataChange }: FormattedNoteViewProps) {
  const notes = board.notes || [];

  return (
    <ScrollArea className="h-[70vh] pr-4">
      <div className="space-y-4">
        {notes.length > 0 ? (
          notes.map(note => (
            <Card key={note.id} className="dark:bg-card/50">
              <CardContent className="pt-6">
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{note.content}</ReactMarkdown>
                </article>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>This board has no notes yet.</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}