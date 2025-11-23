
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { format, isSameDay, subDays, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, BookHeart, Save, Wand2, Loader2, Info, BookCheck, BrainCircuit, Type, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { AppData, JournalEntry, Mood } from '@/lib/types';
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
import MoodSelector from './MoodSelector';
import { moodEmojiMap } from '@/lib/types';
import TemplateChooser from './TemplateChooser';
import StreakDisplay from './StreakDisplay';
import { Badge } from '../ui/badge';

interface JournalManagerProps {
  journalEntries: JournalEntry[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

interface AIReflection {
    reflection: string;
    followUpQuestion: string;
    emotion: string;
    writingStyle: string;
    mainThemes: string[];
    isLoading: boolean;
}

export default function JournalManager({ journalEntries, data, onDataChange }: JournalManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentContent, setCurrentContent] = useState('');
  const [currentMood, setCurrentMood] = useState<Mood | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [aiReflection, setAiReflection] = useState<AIReflection>({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false });
  const [isTemplateChooserOpen, setTemplateChooserOpen] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const todaysEntry = useMemo(() => {
    return journalEntries.find(entry => isSameDay(new Date(entry.date), selectedDate));
  }, [journalEntries, selectedDate]);

  useEffect(() => {
    setCurrentContent(todaysEntry?.content || '');
    setCurrentMood(todaysEntry?.mood);
    setAiReflection({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false }); // Reset reflection when date changes
    setIsEditing(!todaysEntry);
  }, [todaysEntry, selectedDate]);

  const handleSave = () => {
    // Trim check for content is important, but allow saving mood even with empty content
    if (!currentContent.trim() && !currentMood) return;
    
    let updatedEntries;
    if (todaysEntry) {
      // Update existing entry
      updatedEntries = journalEntries.map(entry =>
        entry.id === todaysEntry.id ? { ...entry, content: currentContent, mood: currentMood } : entry
      );
    } else {
      // Create new entry
      const newEntry: JournalEntry = {
        id: uuidv4(),
        date: selectedDate.toISOString(),
        content: currentContent,
        mood: currentMood,
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
        if(currentContent.trim() || currentMood !== todaysEntry?.mood) {
           handleSave();
        }
      }, 2000); // Auto-save after 2 seconds of inactivity
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [currentContent, currentMood, isEditing]);
  
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
    }
  }, [isEditing]);
  
  const handleGetReflection = async () => {
    if (!todaysEntry?.content) return;
    setAiReflection({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: true });
    try {
        const result = await reflectOnJournalEntry({ content: todaysEntry.content });
        setAiReflection({ ...result, isLoading: false });
    } catch(e) {
        console.error(e);
        toast({
            variant: 'destructive',
            title: 'Reflection Failed',
            description: 'Could not generate an AI reflection for this entry.'
        })
        setAiReflection({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false });
    }
  }

  const handleSelectTemplate = (templateContent: string) => {
    setCurrentContent(templateContent);
    setTemplateChooserOpen(false);
    textareaRef.current?.focus();
  }

  const entryDates = useMemo(() => journalEntries.map(entry => new Date(entry.date)), [journalEntries]);

  const moodModifiers = useMemo(() => {
    const modifiers: Record<string, Date[]> = {
        'mood-Ecstatic': [],
        'mood-Happy': [],
        'mood-Neutral': [],
        'mood-Sad': [],
        'mood-Angry': [],
    };
    journalEntries.forEach(entry => {
        if (entry.mood) {
            modifiers[`mood-${entry.mood}`]?.push(new Date(entry.date));
        }
    });
    return modifiers;
  }, [journalEntries]);

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
                  ...moodModifiers
                }}
                modifiersClassNames={{
                  hasEntry: 'has-entry',
                  'mood-Ecstatic': 'mood-ecstatic',
                  'mood-Happy': 'mood-happy',
                  'mood-Neutral': 'mood-neutral',
                  'mood-Sad': 'mood-sad',
                  'mood-Angry': 'mood-angry',
                }}
              />
              <style>{`
                .has-entry:not([class*="mood-"]) { 
                    border: 2px solid hsl(var(--primary));
                    border-radius: var(--radius);
                }
                .mood-ecstatic { --mood-color: hsl(var(--chart-4)); }
                .mood-happy { --mood-color: hsl(var(--chart-2)); }
                .mood-neutral { --mood-color: hsl(var(--muted-foreground)); }
                .mood-sad { --mood-color: hsl(var(--chart-1)); }
                .mood-angry { --mood-color: hsl(var(--destructive)); }
                [class*="mood-"] { 
                  position: relative; 
                  overflow: visible;
                }
                [class*="mood-"]::after {
                  content: '';
                  position: absolute;
                  bottom: 4px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background-color: var(--mood-color);
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
                            <li><strong className="text-foreground">Wins & Lessons:</strong> What was a small victory today? What did you learn?</li>
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
          <StreakDisplay journalEntries={journalEntries} />

          <Card className="min-h-[400px] flex flex-col dark:neon-border">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className='flex-1'>
                    <CardTitle className="flex items-center gap-2">
                      <BookHeart className="text-primary"/>
                      {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                      {currentMood && !isEditing && <span className="text-2xl">{moodEmojiMap[currentMood]}</span>}
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
                    <div className="mb-4">
                      <MoodSelector selectedMood={currentMood} onMoodSelect={setCurrentMood} />
                    </div>
                    {currentContent.length === 0 && (
                      <div className="mb-4">
                        <Button variant="ghost" className="text-primary" onClick={() => setTemplateChooserOpen(true)}>
                          <BookCheck className="mr-2 h-4 w-4" /> Use a Template
                        </Button>
                      </div>
                    )}
                    <Textarea
                      ref={textareaRef}
                      value={currentContent}
                      onChange={(e) => setCurrentContent(e.target.value)}
                      placeholder="Start writing your journal entry here..."
                      className="w-full flex-1 text-base bg-muted/50 border-dashed"
                      rows={15}
                    />
                     <div className="flex justify-end mt-4">
                        <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" /> Save & Finish Editing
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
                    AI Writing Coach
                </Button>

                <AnimatePresence>
                {aiReflection.isLoading ? (
                    <Card className="dark:neon-border-green"><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
                ) : aiReflection.reflection && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="bg-muted/50 dark:neon-border-green">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2"><Wand2 className="text-primary"/> AI Writing Coach</CardTitle>
                                {aiReflection.emotion && <CardDescription>Detected Emotion: {aiReflection.emotion}</CardDescription>}
                            </CardHeader>
                            <CardContent className='space-y-6'>
                                <div className="space-y-4">
                                    <div className='flex items-start gap-3'>
                                        <Type className='h-5 w-5 mt-1 text-primary' />
                                        <div>
                                            <h4 className='font-semibold'>Writing Style</h4>
                                            <p className='text-sm text-muted-foreground'>{aiReflection.writingStyle}</p>
                                        </div>
                                    </div>
                                    <div className='flex items-start gap-3'>
                                        <FileText className='h-5 w-5 mt-1 text-primary' />
                                        <div>
                                            <h4 className='font-semibold'>Main Themes</h4>
                                            <div className='flex flex-wrap gap-2 mt-1'>
                                                {aiReflection.mainThemes.map(theme => <Badge key={theme} variant='secondary'>{theme}</Badge>)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className='flex items-start gap-3'>
                                        <BrainCircuit className='h-5 w-5 mt-1 text-primary' />
                                        <div>
                                            <h4 className='font-semibold'>Reflection</h4>
                                            <p className="text-sm text-muted-foreground italic">"{aiReflection.reflection}"</p>
                                        </div>
                                    </div>
                                </div>
                                {aiReflection.followUpQuestion && (
                                  <div className='p-3 bg-background/50 rounded-lg'>
                                    <p className="font-semibold text-sm">A question for you:</p>
                                    <p className="text-sm text-muted-foreground">{aiReflection.followUpQuestion}</p>
                                  </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
           )}
        </motion.div>
      </div>

      <TemplateChooser 
        open={isTemplateChooserOpen}
        onOpenChange={setTemplateChooserOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
