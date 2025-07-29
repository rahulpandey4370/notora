
'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';

import type { AppData, LogTracker, LogEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import LogTrackerCard from './LogTrackerCard';

interface LogManagerProps {
  logTrackers: LogTracker[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function LogManager({ logTrackers, data, onDataChange }: LogManagerProps) {
    const [newTrackerName, setNewTrackerName] = useState('');
    const [newTrackerUnit, setNewTrackerUnit] = useState('');
    const { toast } = useToast();

    const handleAddTracker = () => {
        if (!newTrackerName.trim() || !newTrackerUnit.trim()) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please provide both a name and a unit for the new tracker.',
            });
            return;
        }

        const newTracker: LogTracker = {
            id: uuidv4(),
            name: newTrackerName.trim(),
            unit: newTrackerUnit.trim(),
            logs: [],
        };

        const updatedTrackers = [...(data.logTrackers || []), newTracker];
        onDataChange({ ...data, logTrackers: updatedTrackers });
        setNewTrackerName('');
        setNewTrackerUnit('');
    };

    const handleDeleteTracker = (trackerId: string) => {
        const updatedTrackers = data.logTrackers.filter(t => t.id !== trackerId);
        onDataChange({ ...data, logTrackers: updatedTrackers });
    };

    const handleTrackerDataChange = (trackerId: string, updatedTrackerData: Partial<LogTracker>) => {
        const updatedTrackers = data.logTrackers.map(t => 
            t.id === trackerId ? { ...t, ...updatedTrackerData } : t
        );
        onDataChange({ ...data, logTrackers: updatedTrackers });
    };

    const containerVariants = {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <Card className="dark:neon-border">
                <CardHeader>
                    <CardTitle>Add New Log Tracker</CardTitle>
                    <CardDescription>
                        Create a new category to track daily. Examples: Weight (kg), Water Intake (ml), Steps.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-2">
                    <Input
                        placeholder="Tracker Name (e.g., Weight)"
                        value={newTrackerName}
                        onChange={(e) => setNewTrackerName(e.target.value)}
                        className="flex-1"
                    />
                    <Input
                        placeholder="Unit (e.g., kg)"
                        value={newTrackerUnit}
                        onChange={(e) => setNewTrackerUnit(e.target.value)}
                        className="w-full sm:w-32"
                    />
                    <Button onClick={handleAddTracker} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add Tracker
                    </Button>
                </CardContent>
            </Card>
            
            <AnimatePresence>
                <motion.div
                    className="space-y-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {logTrackers.map(tracker => (
                        <LogTrackerCard 
                            key={tracker.id}
                            tracker={tracker}
                            onDelete={() => handleDeleteTracker(tracker.id)}
                            onTrackerChange={(updatedData) => handleTrackerDataChange(tracker.id, updatedData)}
                        />
                    ))}
                </motion.div>
            </AnimatePresence>

            {logTrackers.length === 0 && (
                <p className="text-center text-muted-foreground pt-10">
                    You're not tracking any logs yet. Add one above to get started!
                </p>
            )}
        </div>
    );
}
