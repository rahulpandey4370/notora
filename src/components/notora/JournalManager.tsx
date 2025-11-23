'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, BookHeart, Save, Wand2, Loader2, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { AppData, JournalEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { reflectOnJournalEntry } from '@/ai/flows/reflect-on-journal-entry';
import { Skeleton } from '../ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface JournalManagerProps {
  journalEntries: JournalEntry[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

interface AIReflection {
    reflection: string;
    isLoading: boolean;
}

export default function JournalManager({ journalEntries, data, onDataChange }: JournalManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentContent, setCurrentContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [aiReflection, setAiReflection] = useState<AIReflection>({ reflection: '', isLoading: false });
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const todaysEntry = useMemo(() => {
    return journalEntries.find(entry => isSameDay(new Date(entry.date), selectedDate));
  }, [journalEntries, selectedDate]);

  useEffect(() => {
    setCurrentContent(todaysEntry?.content || '');
    setAiReflection({ reflection: '', isLoading: false }); // Reset reflection when date changes
    setIsEditing(!todaysEntry);
  }, [todaysEntry, selectedDate]);

  const handleSave = () => {
    if (!currentContent.trim()) return;
    
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
  
  const handleGetReflection = async () => {
    if (!todaysEntry?.content) return;
    setAiReflection({ reflection: '', isLoading: true });
    try {
        const result = await reflectOnJournalEntry({ content: todaysEntry.content });
        setAiReflection({ reflection: result.reflection, isLoading: false });
    } catch(e) {
        console.error(e);
        toast({
            variant: 'destructive',
            title: 'Reflection Failed',
            description: 'Could not generate an AI reflection for this entry.'
        })
        setAiReflection({ reflection: '', isLoading: false });
    }
  }

  const entryDates = useMemo(() => journalEntries.map(entry => new Date(entry.date)), [journalEntries]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <motion.div 
            className="lg:col-span-1 space-y-8"
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

          <Accordion type="single" collapsible defaultValue="item-1">
            <AccordionItem value="item-1">
                <AccordionTrigger>
                    <h3 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> New to Journaling?</h3>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="text-sm text-muted-foreground space-y-4 p-1">
                        <p>Journaling is a powerful tool for self-reflection. Here are some ideas to get you started:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong className="text-foreground">Daily Reflection:</strong> What went well today? What was challenging?</li>
                            <li><strong className="text-foreground">Gratitude:</strong> List three things you're grateful for and why.</li>
                            <li><strong className="text-foreground">Goal Tracking:</strong> What's one step you took towards a goal today?</li>
                            <li><strong className="text-foreground">Feelings Check-in:</strong> How are you feeling right now? What might be the reason?</li>
                            <li><strong className="text-foreground">Problem-Solving:</strong> Describe a challenge you're facing. What are some possible solutions?</li>
                            <li><strong className="text-foreground">Future Self:</strong> What is one thing you can do today that your future self will thank you for?</li>
                            <li><strong className="text-foreground">Brain Dump:</strong> Write down everything on your mind for 5-10 minutes without judgment.</li>
                        </ul>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Accordion>

        </motion.div>

        <motion.div 
            className="lg:col-span-2 space-y-8"
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
                    {currentContent ? (
                        <ReactMarkdown>{currentContent}</ReactMarkdown>
                    ) : (
                        <div className="text-center text-muted-foreground pt-10">
                            No entry for this day. Click here to start writing.
                        </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
          
           {todaysEntry && !isEditing && (
            <div className="space-y-4">
                <Button onClick={handleGetReflection} disabled={aiReflection.isLoading} className="w-full md:w-auto">
                    {aiReflection.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Reflect with AI
                </Button>

                <AnimatePresence>
                {aiReflection.isLoading ? (
                    <Card className="dark:neon-border-green"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
                ) : aiReflection.reflection && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="bg-muted/50 dark:neon-border-green">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2"><Wand2 className="text-primary"/> AI Reflection</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm italic text-muted-foreground">"{aiReflection.reflection}"</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
           )}

        </motion.div>
      </div>
    </div>
  );
}
