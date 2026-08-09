
'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';

import type { AppData, LogTracker } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import LogTrackerCard from './LogTrackerCard';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

interface LogManagerProps {
  logTrackers: LogTracker[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function LogManager({ logTrackers, data, onDataChange }: LogManagerProps) {
    const [newTrackerName, setNewTrackerName] = useState('');
    const [newTrackerUnit, setNewTrackerUnit] = useState('');
    const [newTrackerGoal, setNewTrackerGoal] = useState('');
    const [newTrackerFlippable, setNewTrackerFlippable] = useState(false);
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
            goal: newTrackerGoal ? parseFloat(newTrackerGoal) : undefined,
            logs: [],
            isFlippable: newTrackerFlippable
        };

        const updatedTrackers = [...(data.logTrackers || []), newTracker];
        onDataChange({ ...data, logTrackers: updatedTrackers });
        setNewTrackerName('');
        setNewTrackerUnit('');
        setNewTrackerGoal('');
        setNewTrackerFlippable(false);
        toast({
            title: 'Tracker Added!',
            description: `You can now start logging your "${newTracker.name}".`,
        })
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
        <div className="space-y-6">
            <Card className="dark:neon-logs">
                <CardHeader>
                    <CardTitle>Manage Trackers</CardTitle>
                    <CardDescription>
                        Create a new category to track. Examples: Weight (kg), Water Intake (ml), Steps.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
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
                        <Input
                            placeholder="Goal (Optional)"
                            type="number"
                            value={newTrackerGoal}
                            onChange={(e) => setNewTrackerGoal(e.target.value)}
                            className="w-full sm:w-32"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="flippable-kpi" checked={newTrackerFlippable} onCheckedChange={setNewTrackerFlippable} />
                            <Label htmlFor="flippable-kpi">Flippable KPI (Avg/Total)</Label>
                        </div>
                        <Button onClick={handleAddTracker} className="w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" /> Add Tracker
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <AnimatePresence>
                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {logTrackers.map((tracker, index) => (
                        <LogTrackerCard 
                            key={tracker.id}
                            tracker={tracker}
                            cardIndex={index}
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
