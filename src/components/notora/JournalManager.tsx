'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BookHeart, Save, Wand2, Loader2, Info, BookCheck, BrainCircuit, Type, FileText, Download, Settings, Trash2, DraftingCompass, FileSignature } from 'lucide-react';
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
import { formatJournalEntry } from '@/ai/flows/format-journal-entry';
import { summarizeJournalEntry } from '@/ai/flows/summarize-journal-entry';
import { Skeleton } from '../ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import MoodSelector from './MoodSelector';
import { moodEmojiMap } from '@/lib/types';
import TemplateChooser from './TemplateChooser';
import StreakDisplay from './StreakDisplay';
import { Badge } from '../ui/badge';
import TagInput from './TagInput';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import JournalDiscovery from './JournalDiscovery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


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

interface JournalEditorProps {
    entry: JournalEntry | undefined;
    selectedDate: Date;
    onSave: (changes: Partial<JournalEntry>) => void;
    onCancel: () => void;
    allTags: string[];
}

const JournalEditor = ({ entry, selectedDate, onSave, onCancel, allTags }: JournalEditorProps) => {
    const [content, setContent] = useState(entry?.content || '');
    const [mood, setMood] = useState(entry?.mood);
    const [tags, setTags] = useState(entry?.tags || []);
    const [isTemplateChooserOpen, setTemplateChooserOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleDataChange = useCallback(() => {
        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
        }
        autoSaveTimer.current = setTimeout(() => {
            onSave({ content, mood, tags });
        }, 30000); // Auto-save after 30 seconds of inactivity
    }, [content, mood, tags, onSave]);

    useEffect(() => {
        handleDataChange();
        return () => {
            if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
            }
        };
    }, [content, mood, tags, handleDataChange]);

    const wordCount = useMemo(() => {
        return content.trim().split(/\s+/).filter(Boolean).length;
    }, [content]);

    const handleSelectTemplate = (templateContent: string) => {
        setContent(prev => prev + templateContent);
        setTemplateChooserOpen(false);
        textareaRef.current?.focus();
    }
    
    const handleSaveClick = () => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        if (!content.trim() && !mood && tags.length === 0 && !entry) {
            onCancel();
            return;
        };
        onSave({ content, mood, tags });
        onCancel(); // Switch back to view mode on explicit save
    }

    return (
        <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <div className="mb-4"><MoodSelector selectedMood={mood} onMoodSelect={setMood} /></div>
            <div className="mb-4"><TagInput tags={tags} setTags={setTags} allTags={allTags} /></div>
            {content.length === 0 && <div className="mb-4"><Button variant="ghost" className="text-primary" onClick={() => setTemplateChooserOpen(true)}><BookCheck className="mr-2 h-4 w-4" /> Use a Template</Button></div>}
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your journal entry here..."
              className="w-full flex-1 text-base bg-muted/50 border-dashed font-sans"
              rows={15}
            />
            <div className="flex items-center justify-end mt-4 gap-4">
                <span className="text-sm text-muted-foreground">{wordCount} word{wordCount !== 1 && 's'}</span>
                <Button onClick={handleSaveClick}><Save className="mr-2 h-4 w-4" /> Save Entry</Button>
            </div>
            <TemplateChooser open={isTemplateChooserOpen} onOpenChange={setTemplateChooserOpen} onSelectTemplate={handleSelectTemplate} />
        </motion.div>
    );
};


export default function JournalManager({ journalEntries: initialJournalEntries, data, onDataChange }: JournalManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [aiReflection, setAiReflection] = useState<AIReflection>({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false });
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiLoading, setAiLoading] = useState<'format' | 'summarize' | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const filteredEntries = useMemo(() => {
    let entries = initialJournalEntries;

    if (activeTagFilter) {
      entries = entries.filter(entry => (entry.tags || []).includes(activeTagFilter));
    }
    
    if (searchQuery) {
        entries = entries.filter(entry => entry.content.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return entries;
  }, [initialJournalEntries, activeTagFilter, searchQuery]);

  const todaysEntry = useMemo(() => {
    return filteredEntries.find(entry => isSameDay(new Date(entry.date), selectedDate));
  }, [filteredEntries, selectedDate]);

  useEffect(() => {
    if (!todaysEntry) {
        setIsEditing(true);
    } else {
        setIsEditing(false);
    }
    setAiReflection({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false });
  }, [todaysEntry, selectedDate]);
  
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    initialJournalEntries.forEach(entry => {
        (entry.tags || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [initialJournalEntries]);

  const handleSave = (changes: Partial<JournalEntry>) => {
    let updatedEntries;
    const existingEntry = initialJournalEntries.find(entry => isSameDay(new Date(entry.date), selectedDate));

    if (existingEntry) {
      updatedEntries = initialJournalEntries.map(entry =>
        entry.id === existingEntry.id ? { ...entry, ...changes } : entry
      );
    } else {
      if (!changes.content?.trim() && !changes.mood && (!changes.tags || changes.tags.length === 0)) {
        return; // Don't create an empty entry
      }
      const newEntry: JournalEntry = {
        id: uuidv4(),
        date: selectedDate.toISOString(),
        content: changes.content || '',
        mood: changes.mood,
        tags: changes.tags
      };
      updatedEntries = [...initialJournalEntries, newEntry];
    }
    
    if(updatedEntries) {
        onDataChange({ ...data, journalEntries: updatedEntries });
    }
  };

  const handleDelete = () => {
    if (!todaysEntry) return;

    const updatedEntries = initialJournalEntries.filter(entry => entry.id !== todaysEntry.id);
    onDataChange({ ...data, journalEntries: updatedEntries });
    
    toast({
      title: 'Entry Deleted',
      description: `Your journal entry for ${format(selectedDate, 'PPP')} has been deleted.`,
    });
    
    setAiReflection({ reflection: '', followUpQuestion: '', emotion: '', writingStyle: '', mainThemes: [], isLoading: false });
    setIsEditing(true);
  };
  
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

  const handleFormatEntry = async () => {
    if (!todaysEntry?.content) return;
    setAiLoading('format');
    try {
        const result = await formatJournalEntry({ content: todaysEntry.content });
        handleSave({ content: result.formattedContent });
        toast({ title: 'Journal Formatted', description: 'AI has beautifully formatted your entry.' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Formatting Failed' });
    } finally {
        setAiLoading(null);
    }
  }

  const handleSummarizeEntry = async () => {
    if (!todaysEntry?.content) return;
    setAiLoading('summarize');
    try {
        const result = await summarizeJournalEntry({ content: todaysEntry.content });
        handleSave({ aiSummary: result.summary });
        toast({ title: 'Summary Generated', description: 'An AI-powered summary has been saved with your entry.' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Summarization Failed' });
    } finally {
        setAiLoading(null);
    }
  }

  const handleExport = (formatType: 'json' | 'md') => {
    let content = '';
    let mimeType = '';
    let fileName = `notora-journal-${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === 'json') {
        content = JSON.stringify(initialJournalEntries, null, 2);
        mimeType = 'application/json';
        fileName += '.json';
    } else if (formatType === 'md') {
        content = initialJournalEntries
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(entry => {
                let md = `## ${format(new Date(entry.date), 'EEEE, MMMM do, yyyy')}\n\n`;
                if (entry.mood) {
                    md += `**Mood:** ${entry.mood} ${moodEmojiMap[entry.mood]}\n`;
                }
                if (entry.tags && entry.tags.length > 0) {
                    md += `**Tags:** ${entry.tags.map(t => `#${t}`).join(' ')}\n`;
                }
                if (entry.mood || (entry.tags && entry.tags.length > 0)) {
                    md += '\n';
                }
                md += `${entry.content}\n\n---\n\n`;
                return md;
            }).join('');
        mimeType = 'text/markdown';
        fileName += '.md';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: `Your journal has been downloaded as a ${formatType.toUpperCase()} file.`,
    });
  };

  const entryDates = useMemo(() => filteredEntries.map(entry => new Date(entry.date)), [filteredEntries]);

  const moodModifiers = useMemo(() => {
    const modifiers: Record<string, Date[]> = {
        'mood-Ecstatic': [], 'mood-Happy': [], 'mood-Neutral': [], 'mood-Sad': [], 'mood-Angry': [],
    };
    filteredEntries.forEach(entry => {
        if (entry.mood) {
            modifiers[`mood-${entry.mood}`]?.push(new Date(entry.date));
        }
    });
    return modifiers;
  }, [filteredEntries]);

  const JournalEditorContent = useCallback(() => (
      <motion.div 
        className="lg:col-span-2 space-y-8"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <StreakDisplay journalEntries={initialJournalEntries} />
        <Card className="min-h-[400px] flex flex-col dark:neon-border">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className='flex-1'>
                    <CardTitle className="flex items-center gap-2">
                      <BookHeart className="text-primary"/>
                      {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                      {todaysEntry?.mood && !isEditing && <span className="text-2xl">{moodEmojiMap[todaysEntry.mood]}</span>}
                    </CardTitle>
                    <CardDescription>
                    {todaysEntry ? `Your thoughts from this day.` : `What's on your mind today?`}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> Export</Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExport('md')}>Export as Markdown (.md)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')}>Export as JSON (.json)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {!isEditing && todaysEntry && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete your journal entry for {format(selectedDate, 'PPP')}. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {!isEditing && <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <JournalEditor 
                    entry={todaysEntry}
                    selectedDate={selectedDate}
                    onSave={handleSave}
                    onCancel={() => setIsEditing(false)}
                    allTags={allTags}
                  />
                ) : (
                  <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="prose dark:prose-invert max-w-none cursor-pointer flex-1 font-sans" onClick={() => setIsEditing(true)}>
                    {todaysEntry?.tags && todaysEntry.tags.length > 0 && <div className="flex flex-wrap gap-2 mb-4">{todaysEntry.tags.map(tag => <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveTagFilter(tag); }}>{tag}</Badge>)}</div>}
                    {todaysEntry?.aiSummary && (
                         <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> AI Summary</h4>
                            <div className="prose-sm dark:prose-invert text-muted-foreground"><ReactMarkdown>{todaysEntry.aiSummary}</ReactMarkdown></div>
                        </div>
                    )}
                    {todaysEntry?.content ? <ReactMarkdown>{todaysEntry.content}</ReactMarkdown> : <div className="text-center text-muted-foreground pt-10">No entry for this day. Click here to start writing.</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
           {todaysEntry && !isEditing && (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGetReflection} disabled={aiReflection.isLoading} className="w-full sm:w-auto flex-1"><Wand2 className="mr-2 h-4 w-4" /> AI Writing Coach</Button>
                    <Button onClick={handleFormatEntry} disabled={!!aiLoading} variant="outline" className="w-full sm:w-auto flex-1">
                        {aiLoading === 'format' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DraftingCompass className="mr-2 h-4 w-4" />} Format Entry
                    </Button>
                    <Button onClick={handleSummarizeEntry} disabled={!!aiLoading} variant="outline" className="w-full sm:w-auto flex-1">
                        {aiLoading === 'summarize' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />} AI Summary
                    </Button>
                </div>
                <AnimatePresence>
                {aiReflection.isLoading ? (
                    <Card className="dark:neon-border-green"><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
                ) : aiReflection.reflection && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <Card className="bg-muted/50 dark:neon-border-green">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2"><Wand2 className="text-primary"/> AI Writing Coach</CardTitle>
                                {aiReflection.emotion && <CardDescription>Detected Emotion: {aiReflection.emotion}</CardDescription>}
                            </CardHeader>
                            <CardContent className='space-y-6'>
                                <div className="space-y-4">
                                    <div className='flex items-start gap-3'><Type className='h-5 w-5 mt-1 text-primary' /><div><h4 className='font-semibold'>Writing Style</h4><p className='text-sm text-muted-foreground'>{aiReflection.writingStyle}</p></div></div>
                                    <div className='flex items-start gap-3'><FileText className='h-5 w-5 mt-1 text-primary' /><div><h4 className='font-semibold'>Main Themes</h4><div className='flex flex-wrap gap-2 mt-1'>{aiReflection.mainThemes.map(theme => <Badge key={theme} variant='secondary'>{theme}</Badge>)}</div></div></div>
                                    <div className='flex items-start gap-3'><BrainCircuit className='h-5 w-5 mt-1 text-primary' /><div><h4 className='font-semibold'>Reflection</h4><p className="text-sm text-muted-foreground italic">"{aiReflection.reflection}"</p></div></div>
                                </div>
                                {aiReflection.followUpQuestion && (
                                    <div className='p-3 bg-background/50 rounded-lg space-y-2'>
                                        <p className="font-semibold text-sm">A question for you:</p>
                                        <p className="text-sm text-muted-foreground">{aiReflection.followUpQuestion}</p>
                                        <Textarea 
                                            placeholder='Your thoughts...'
                                            defaultValue={todaysEntry.coachResponse || ''}
                                            onBlur={(e) => handleSave({ coachResponse: e.target.value })}
                                            className='mt-2'
                                        />
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
  ), [selectedDate, todaysEntry, isEditing, aiReflection, allTags, initialJournalEntries, activeTagFilter, searchQuery, aiLoading, handleSave]);

  const DesktopLayout = () => (
     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <motion.div 
            className="lg:col-span-1 space-y-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-8">
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
                  modifiers={{ hasEntry: entryDates, ...moodModifiers }}
                  modifiersClassNames={{ hasEntry: 'has-entry', 'mood-Ecstatic': 'mood-ecstatic', 'mood-Happy': 'mood-happy', 'mood-Neutral': 'mood-neutral', 'mood-Sad': 'mood-sad', 'mood-Angry': 'mood-angry' }}
                />
              </CardContent>
            </Card>
             <JournalDiscovery 
              entries={initialJournalEntries}
              onDateSelect={setSelectedDate}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          </div>
          
          <Card className='dark:neon-border-blue'>
            <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Filter your entries by tag.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                <Badge onClick={() => setActiveTagFilter(null)} className={cn("cursor-pointer transition-all", activeTagFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>All</Badge>
                {allTags.map(tag => (
                    <Badge key={tag} onClick={() => setActiveTagFilter(tag)} className={cn("cursor-pointer transition-all", activeTagFilter === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{tag}</Badge>
                ))}
            </CardContent>
          </Card>

          <Accordion type="single" collapsible defaultValue="item-1">
            <AccordionItem value="item-1">
                <AccordionTrigger><h3 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> New to Journaling?</h3></AccordionTrigger>
                <AccordionContent>
                    <div className="text-sm text-muted-foreground space-y-4 p-1">
                        <p>Journaling is a powerful tool for self-reflection. Here are some ideas to get you started:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong className="text-foreground">Daily Reflection:</strong> What went well today? What was challenging?</li>
                            <li><strong className="text-foreground">Gratitude:</strong> List three things you're grateful for and why.</li>
                            <li><strong className="text-foreground">Goal Tracking:</strong> What's one step you took towards a goal today?</li>
                            <li><strong className="text-foreground">Feelings Check-in:</strong> How are you feeling right now? What might be the reason?</li>
                        </ul>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
        
        <JournalEditorContent />
    </div>
  );

  const MobileLayout = () => (
     <Tabs defaultValue="journal" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="journal">Journal</TabsTrigger>
        <TabsTrigger value="explore">Explore</TabsTrigger>
      </TabsList>
      <TabsContent value="journal" className="mt-6">
        <JournalEditorContent />
      </TabsContent>
      <TabsContent value="explore" className="mt-6 space-y-8">
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
              modifiers={{ hasEntry: entryDates, ...moodModifiers }}
              modifiersClassNames={{ hasEntry: 'has-entry', 'mood-Ecstatic': 'mood-ecstatic', 'mood-Happy': 'mood-happy', 'mood-Neutral': 'mood-neutral', 'mood-Sad': 'mood-sad', 'mood-Angry': 'mood-angry' }}
            />
          </CardContent>
        </Card>
        <JournalDiscovery 
            entries={initialJournalEntries}
            onDateSelect={setSelectedDate}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
        />
        <Card className='dark:neon-border-blue'>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Filter your entries by tag.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge onClick={() => setActiveTagFilter(null)} className={cn("cursor-pointer transition-all", activeTagFilter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>All</Badge>
            {allTags.map(tag => (
              <Badge key={tag} onClick={() => setActiveTagFilter(tag)} className={cn("cursor-pointer transition-all", activeTagFilter === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{tag}</Badge>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <style>{`
        .has-entry:not([class*="mood-"]) { border: 2px solid hsl(var(--primary)); border-radius: var(--radius); }
        .mood-ecstatic { --mood-color: hsl(var(--chart-4)); } .mood-happy { --mood-color: hsl(var(--chart-2)); } .mood-neutral { --mood-color: hsl(var(--muted-foreground)); } .mood-sad { --mood-color: hsl(var(--chart-1)); } .mood-angry { --mood-color: hsl(var(--destructive)); }
        [class*="mood-"] { position: relative; overflow: visible; }
        [class*="mood-"]::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; border-radius: 50%; background-color: var(--mood-color); }
        .rdp-day_today { font-weight: bold; color: hsl(var(--chart-2)); }
      `}</style>

      {isMobile ? <MobileLayout /> : <DesktopLayout />}

    </div>
  );
}
