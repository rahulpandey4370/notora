
'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus } from 'lucide-react';
import type { AppData, LogEntry } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddNewLogCardProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function AddNewLogCard({ data, onDataChange }: AddNewLogCardProps) {
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | undefined>(data.logTrackers[0]?.id);
  const [date, setDate] = useState<Date>(new Date());
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleAddLog = () => {
    if (!selectedTrackerId) {
      toast({ variant: 'destructive', title: 'No Tracker Selected', description: 'Please select a tracker to add a log to.' });
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast({ variant: 'destructive', title: 'Invalid Value', description: 'Please enter a valid number for the log.' });
      return;
    }

    const logDate = format(date, 'yyyy-MM-dd');

    const updatedTrackers = data.logTrackers.map(tracker => {
      if (tracker.id === selectedTrackerId) {
        const existingLogIndex = tracker.logs.findIndex(log => log.date === logDate);
        let newLogs: LogEntry[];

        if (existingLogIndex > -1) {
          // Update existing log for that date
          newLogs = [...tracker.logs];
          newLogs[existingLogIndex] = { ...newLogs[existingLogIndex], value: numValue, notes: notes || newLogs[existingLogIndex].notes };
           toast({ title: 'Log Updated', description: `Entry for ${tracker.name} on ${logDate} has been updated.` });
        } else {
          // Add a new log
          const newLog: LogEntry = { id: uuidv4(), date: logDate, value: numValue, notes };
          newLogs = [...tracker.logs, newLog];
           toast({ title: 'Log Added', description: `New entry for ${tracker.name} on ${logDate} has been added.` });
        }
        return { ...tracker, logs: newLogs };
      }
      return tracker;
    });

    onDataChange({ ...data, logTrackers: updatedTrackers });
    setValue('');
    setNotes('');
  };
  
  const selectedTracker = data.logTrackers.find(t => t.id === selectedTrackerId);

  return (
    <Card className="dark:neon-border-green">
      <CardHeader>
        <CardTitle>Add New Log Entry</CardTitle>
        <CardDescription>Quickly add a new log to any of your trackers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={selectedTrackerId} onValueChange={setSelectedTrackerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tracker..." />
              </SelectTrigger>
              <SelectContent>
                {data.logTrackers.map(tracker => (
                  <SelectItem key={tracker.id} value={tracker.id}>{tracker.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
            </Popover>

            <Input 
                type="number"
                placeholder={selectedTracker ? `Value in ${selectedTracker.unit}` : 'Value'}
                value={value}
                onChange={e => setValue(e.target.value)}
            />
            
            <Button onClick={handleAddLog} disabled={!selectedTrackerId || !value}>
                <Plus className="mr-2 h-4 w-4" /> Add/Update Log
            </Button>
        </div>
        <Textarea 
            placeholder="Add any notes (optional)..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
