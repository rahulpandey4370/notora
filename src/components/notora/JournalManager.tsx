
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, BookHeart, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { AppData, JournalEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface JournalManagerProps {
  journalEntries: JournalEntry[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function JournalManager({ journalEntries, data, onDataChange }: JournalManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentContent, setCurrentContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const todaysEntry = useMemo(() => {
    return journalEntries.find(entry => isSameDay(new Date(entry.date), selectedDate));
  }, [journalEntries, selectedDate]);

  useEffect(() => {
    setCurrentContent(todaysEntry?.content || '');
    setIsEditing(!todaysEntry);
  }, [todaysEntry]);

  const handleSave = () => {
    let updatedEntries;
    if (todaysEntry) {
      // Update existing entry
      updatedEntries = journalEntries.map(entry =>
        entry.id === todaysEntry.id ? { ...entry, content: currentContent } : entry
      );
    } else {
      // Create new entry
      const newEntry: JournalEntry = {
        id: uuidv4(),
        date: selectedDate.toISOString(),
        content: currentContent,
      };
      updatedEntries = [...journalEntries, newEntry];
    }
    onDataChange({ ...data, journalEntries: updatedEntries });
    toast({
        title: 'Journal Saved',
        description: `Your entry for ${format(selectedDate, 'PPP')} has been saved.`,
    });
    setIsEditing(false);
  };
  
  useEffect(() => {
    if (isEditing) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if(currentContent.trim()) {
           handleSave();
        }
      }, 2000); // Auto-save after 2 seconds of inactivity
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [currentContent, isEditing]);
  
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
    }
  }, [isEditing]);

  const entryDates = useMemo(() => journalEntries.map(entry => new Date(entry.date)), [journalEntries]);

  return (
    <div className="p-4 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <motion.div 
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
        >
          <Card className="dark:neon-border-blue">
            <CardHeader>
              <CardTitle>Journal Calendar</CardTitle>
              <CardDescription>Select a day to write or reflect.</CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="p-0"
                modifiers={{
                  hasEntry: entryDates,
                }}
                modifiersClassNames={{
                  hasEntry: 'has-entry',
                }}
              />
              <style>{`
                .has-entry { 
                    border: 2px solid hsl(var(--primary));
                    border-radius: var(--radius);
                }
                .rdp-day_today { 
                    font-weight: bold;
                    color: hsl(var(--chart-2));
                }
              `}</style>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="min-h-[400px] flex flex-col dark:neon-border">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="flex items-center gap-2">
                    <BookHeart className="text-primary"/>
                    {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                    </CardTitle>
                    <CardDescription>
                    {todaysEntry ? `Your thoughts from this day.` : `What's on your mind today?`}
                    </CardDescription>
                </div>
                {!isEditing && (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col"
                  >
                    <Textarea
                      ref={textareaRef}
                      value={currentContent}
                      onChange={(e) => setCurrentContent(e.target.value)}
                      placeholder="Start writing your journal entry here..."
                      className="w-full flex-1 text-base bg-muted/50 border-dashed"
                      rows={15}
                    />
                     <div className="flex justify-end mt-4">
                        <Button onClick={handleSave} disabled={!currentContent.trim()}>
                            <Save className="mr-2 h-4 w-4" /> Save Entry
                        </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="viewer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="prose dark:prose-invert max-w-none text-base cursor-pointer flex-1"
                    onClick={() => setIsEditing(true)}
                  >
                    <ReactMarkdown>{currentContent}</ReactMarkdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
