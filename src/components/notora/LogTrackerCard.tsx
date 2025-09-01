'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, isValid, differenceInDays, isAfter, startOfDay, getWeek, getYear, startOfToday, subWeeks, isWithinInterval, endOfWeek, startOfWeek } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Dot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Edit, Save, Trash2, X, Wand2, Loader2, TrendingUp, TrendingDown, Minus, ArrowRight, Target, Plus, LineChart as LineChartIcon, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogEntry, LogTracker } from '@/lib/types';
import { getLogInsights } from '@/ai/flows/get-log-insights';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import AllLogsDialog from './AllLogsDialog';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LogTrackerCardProps {
    tracker: LogTracker;
    cardIndex: number;
    onDelete: () => void;
    onTrackerChange: (updatedData: Partial<LogTracker>) => void;
}

interface AiInsight {
    feedback: string;
    trend: 'upward' | 'downward' | 'stable' | 'fluctuating';
}

const cardColors = [
    "dark:neon-border-chart-1",
    "dark:neon-border-chart-2",
    "dark:neon-border-chart-3",
    "dark:neon-border-chart-4",
    "dark:neon-border-chart-5",
];

const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
]

const chartBgColors = [
    "hsl(var(--chart-1) / 0.1)",
    "hsl(var(--chart-2) / 0.1)",
    "hsl(var(--chart-3) / 0.1)",
    "hsl(var(--chart-4) / 0.1)",
    "hsl(var(--chart-5) / 0.1)",
]


export default function LogTrackerCard({ tracker, cardIndex, onDelete, onTrackerChange }: LogTrackerCardProps) {
    const [date, setDate] = useState<Date>(new Date());
    const [value, setValue] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
    const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
    const [loadingInsight, setLoadingInsight] = useState(false);
    const [showTrendLine, setShowTrendLine] = useState(false);
    const [show7dTotal, setShow7dTotal] = useState(false);
    const [show30dTotal, setShow30dTotal] = useState(false);
    const [allLogsOpen, setAllLogsOpen] = useState(false);

    const sortedLogs = useMemo(() => tracker.logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [tracker.logs]);
    const recentLogs = useMemo(() => sortedLogs.slice(-30), [sortedLogs]);
    
    const chartData = useMemo(() => recentLogs.map(log => ({
        name: format(parseISO(log.date), 'MMM d'),
        [tracker.unit]: log.value,
        ...log
    })), [recentLogs, tracker.unit]);
    
    const kpis = useMemo(() => {
        if (sortedLogs.length === 0) return null;

        const today = startOfToday();
        const thisWeek = { start: startOfWeek(today), end: endOfWeek(today) };
        const lastWeek = { start: startOfWeek(subWeeks(today, 1)), end: endOfWeek(subWeeks(today, 1)) };
        
        const logsThisWeek = sortedLogs.filter(l => isWithinInterval(parseISO(l.date), thisWeek));
        const logsLastWeek = sortedLogs.filter(l => isWithinInterval(parseISO(l.date), lastWeek));

        const avgThisWeek = logsThisWeek.length > 0 ? logsThisWeek.reduce((acc, l) => acc + l.value, 0) / logsThisWeek.length : 0;
        const avgLastWeek = logsLastWeek.length > 0 ? logsLastWeek.reduce((acc, l) => acc + l.value, 0) / logsLastWeek.length : 0;
        
        let weeklyChange: number | null = null;
        if (avgThisWeek > 0 && avgLastWeek > 0) {
            weeklyChange = ((avgThisWeek - avgLastWeek) / avgLastWeek) * 100;
        }

        const latest = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].value : 0;
        const total30d = recentLogs.reduce((a, b) => a + b.value, 0);
        const average30d = recentLogs.length > 0 ? total30d / recentLogs.length : 0;
        
        const sevenDayLogs = sortedLogs.filter(log => differenceInDays(new Date(), parseISO(log.date)) < 7);
        const total7d = sevenDayLogs.reduce((a, b) => a + b.value, 0);
        const average7d = sevenDayLogs.length > 0 ? total7d / sevenDayLogs.length : 0;

        const high = Math.max(...recentLogs.map(l => l.value));
        const low = Math.min(...recentLogs.map(l => l.value));

        return { latest, average30d, average7d, high, low, total7d, total30d, weeklyChange };
    }, [sortedLogs, recentLogs]);

    const isFlippable = tracker.isFlippable || tracker.name === 'Protein Intake' || tracker.name === 'Steps' || tracker.name === 'Daily Calorie Intake';

    const handleToggle7dView = () => {
        if (isFlippable) {
            setShow7dTotal(prev => !prev);
        }
    };

    const handleToggle30dView = () => {
        if (isFlippable) {
            setShow30dTotal(prev => !prev);
        }
    };

    const chartDataWithTrend = useMemo(() => {
        if (recentLogs.length < 2) return chartData.map(d => ({ ...d, trend: d[tracker.unit] }));
    
        const n = recentLogs.length;
        const x = recentLogs.map((_, i) => i);
        const y = recentLogs.map(log => log.value);

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, _, i) => acc + x[i] * y[i], 0);
        const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
    
        if (isNaN(slope) || isNaN(intercept)) return chartData.map(d => ({ ...d, trend: d[tracker.unit] }));;
    
        return chartData.map((dataPoint, i) => ({
            ...dataPoint,
            trend: slope * i + intercept,
        }));
    }, [recentLogs, chartData, tracker.unit]);


    const handleAddOrUpdateLog = () => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        const logDate = format(date, 'yyyy-MM-dd');
        
        if (editingLog) {
            // Update existing log
            const updatedLogs = tracker.logs.map(log =>
                log.id === editingLog.id ? { ...log, date: logDate, value: numValue, notes } : log
            );
            onTrackerChange({ logs: updatedLogs });
            setEditingLog(null);
        } else {
            // Add new log, but first check if one for this date already exists
            const existingLogIndex = tracker.logs.findIndex(log => log.date === logDate);
            let newLogs: LogEntry[];

            if (existingLogIndex > -1) {
                // Update the existing log for the selected date
                newLogs = [...tracker.logs];
                newLogs[existingLogIndex] = { ...newLogs[existingLogIndex], value: numValue, notes: notes || newLogs[existingLogIndex].notes };
            } else {
                // Add a new log
                const newLog: LogEntry = {
                    id: uuidv4(),
                    date: logDate,
                    value: numValue,
                    notes,
                };
                newLogs = [...tracker.logs, newLog];
            }
            onTrackerChange({ logs: newLogs });
        }
        
        setValue('');
        setNotes('');
        setDate(new Date());
    };

    const handleEditClick = (log: LogEntry) => {
        setEditingLog(log);
        const logDate = parseISO(log.date);
        setDate(isValid(logDate) ? logDate : new Date());
        setValue(String(log.value));
        setNotes(log.notes || '');
    };

    const handleCancelEdit = () => {
        setEditingLog(null);
        setValue('');
        setNotes('');
        setDate(new Date());
    };

    const handleDeleteLog = (logId: string) => {
        const updatedLogs = tracker.logs.filter(log => log.id !== logId);
        onTrackerChange({ logs: updatedLogs });
    };

    const handleGetInsights = async () => {
        if (tracker.logs.length < 2) return;
        setLoadingInsight(true);
        setAiInsight(null);
        try {
            const result = await getLogInsights({
                trackerName: tracker.name,
                unit: tracker.unit,
                goal: tracker.goal,
                logHistory: sortedLogs.slice(-30).map(l => ({...l, notes: l.notes || ''})),
            });
            setAiInsight(result);
        } catch (error) {
            console.error("Failed to get AI insights:", error);
        } finally {
            setLoadingInsight(false);
        }
    };
    
    const TrendIcon = ({trend}: {trend: 'upward' | 'downward' | 'stable' | 'fluctuating'}) => {
        switch(trend) {
            case 'upward': return <TrendingUp className="h-5 w-5 text-green-500" />;
            case 'downward': return <TrendingDown className="h-5 w-5 text-red-500" />;
            case 'stable': return <Minus className="h-5 w-5 text-yellow-500" />;
            case 'fluctuating': return <ArrowRight className="h-5 w-5 text-blue-500" />; // changed this icon
        }
    }
    
    const cardColorClass = cardColors[cardIndex % cardColors.length];
    const chartColor = chartColors[cardIndex % chartColors.length];
    const chartBgColor = chartBgColors[cardIndex % chartColors.length];

    return (
        <>
        <motion.div
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring' }}
        >
            <Card className={cardColorClass}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{tracker.name}</CardTitle>
                            <CardDescription>Unit: {tracker.unit} {tracker.goal ? `| Goal: ${tracker.goal}` : ''}</CardDescription>
                        </div>
                        <div className="flex items-center">
                            <Button variant="outline" size="sm" className="mr-2" onClick={() => setAllLogsOpen(true)}>
                                <BookOpen className="mr-2 h-4 w-4" /> View All
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete the "{tracker.name}" tracker and all its logs. This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{editingLog ? 'Edit Log Entry' : 'Add New Log'}</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full sm:w-[280px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                    )}
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
                                placeholder={`Value in ${tracker.unit}`}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                className="w-full sm:flex-1"
                            />
                        </div>
                        <Textarea 
                            placeholder="Add any notes (optional)..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleAddOrUpdateLog} 
                                className="w-full"
                                style={{backgroundColor: chartColor}}
                            >
                                {editingLog ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {editingLog ? 'Save Changes' : 'Add Log'}
                            </Button>
                            {editingLog && (
                                <Button onClick={handleCancelEdit} variant="outline" className="w-full">
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2 pt-4">
                            <h4 className="font-semibold">Recent Logs:</h4>
                            <div className="max-h-60 overflow-y-auto pr-2">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedLogs.slice(-5).reverse().map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell>{format(parseISO(log.date), 'MMM d, yyyy')}</TableCell>
                                                <TableCell>{log.value} {tracker.unit}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(log)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sortedLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No logs yet.</p>}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className='space-y-4'>
                            <h3 className="font-semibold text-lg">At a Glance</h3>
                            {kpis ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 text-center">
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: chartBgColor }}>
                                        <p className="text-xs text-muted-foreground">Latest</p>
                                        <p className="text-lg font-bold">{kpis.latest.toLocaleString()}</p>
                                    </div>
                                    <TooltipProvider>
                                    <UiTooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                        <div 
                                            className={cn("p-2 rounded-lg", isFlippable && "cursor-pointer")}
                                            style={{ backgroundColor: chartBgColor }}
                                            onClick={handleToggle7dView}
                                        >
                                            <p className="text-xs text-muted-foreground">{show7dTotal ? '7d Total' : '7d Avg'}</p>
                                            <p className="text-lg font-bold">
                                                {show7dTotal ? kpis.total7d.toLocaleString() : kpis.average7d.toFixed(1)}
                                            </p>
                                        </div>
                                        </TooltipTrigger>
                                        {isFlippable && (
                                            <TooltipContent>
                                                <p>Click to toggle total/average</p>
                                            </TooltipContent>
                                        )}
                                    </UiTooltip>
                                    <UiTooltip delayDuration={0}>
                                        <TooltipTrigger asChild>
                                        <div 
                                            className={cn("p-2 rounded-lg", isFlippable && "cursor-pointer")}
                                            style={{ backgroundColor: chartBgColor }}
                                            onClick={handleToggle30dView}
                                        >
                                            <p className="text-xs text-muted-foreground">{show30dTotal ? '30d Total' : '30d Avg'}</p>
                                            <p className="text-lg font-bold">
                                                {show30dTotal ? kpis.total30d.toLocaleString() : kpis.average30d.toFixed(1)}
                                            </p>
                                        </div>
                                        </TooltipTrigger>
                                        {isFlippable && (
                                            <TooltipContent>
                                                <p>Click to toggle total/average</p>
                                            </TooltipContent>
                                        )}
                                    </UiTooltip>
                                    </TooltipProvider>
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: chartBgColor }}>
                                        <p className="text-xs text-muted-foreground">WoW Change</p>
                                        <p className={cn(
                                            "text-lg font-bold",
                                            kpis.weeklyChange === null ? "" : kpis.weeklyChange > 0 ? "text-green-500" : "text-red-500"
                                        )}>
                                            {kpis.weeklyChange === null ? "N/A" : `${kpis.weeklyChange.toFixed(1)}%`}
                                        </p>
                                    </div>
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: chartBgColor }}>
                                        <p className="text-xs text-muted-foreground">30d High</p>
                                        <p className="text-lg font-bold">{kpis.high.toLocaleString()}</p>
                                    </div>
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: chartBgColor }}>
                                        <p className="text-xs text-muted-foreground">30d Low</p>
                                        <p className="text-lg font-bold">{kpis.low.toLocaleString()}</p>
                                    </div>
                                </div>
                            ) : (
                                 <p className="text-sm text-muted-foreground text-center py-4">Not enough data for KPIs.</p>
                            )}
                        </div>
                        <div className='space-y-2'>
                             <div className="flex items-center justify-between pt-4">
                                <h3 className="font-semibold text-lg">Progress Chart</h3>
                                {chartData.length >= 2 && (
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`trend-switch-${tracker.id}`}
                                            checked={showTrendLine}
                                            onCheckedChange={setShowTrendLine}
                                        />
                                        <Label htmlFor={`trend-switch-${tracker.id}`} className="flex items-center gap-1 text-sm">
                                            <LineChartIcon className="h-4 w-4" /> Trend
                                        </Label>
                                    </div>
                                )}
                            </div>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={chartDataWithTrend}>
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 1', 'dataMax + 1']} />
                                    <Tooltip 
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            borderColor: 'hsl(var(--border))'
                                        }}
                                    />
                                    <Legend />
                                    {tracker.goal && <ReferenceLine y={tracker.goal} label={{ value: `Goal: ${tracker.goal}`, position: 'insideTopLeft' }} stroke="hsl(var(--primary))" strokeDasharray="3 3" />}
                                    <Line type="monotone" dataKey={tracker.unit} stroke={chartColor} strokeWidth={2} dot={<Dot r={4} fill={chartColor} />} activeDot={{ r: 6 }} />
                                    {showTrendLine && (
                                        <Line
                                            type="monotone"
                                            dataKey="trend"
                                            stroke={chartColor}
                                            strokeWidth={2}
                                            strokeOpacity={0.8}
                                            strokeDasharray="5 5"
                                            dot={false}
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                             <Button onClick={handleGetInsights} disabled={loadingInsight || tracker.logs.length < 2} className="w-full">
                                {loadingInsight ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                Get AI Coach Insights
                            </Button>
                            {tracker.logs.length < 2 && <p className="text-xs text-muted-foreground text-center mt-1">Need at least 2 logs for insights.</p>}
                        </div>

                        {loadingInsight && (
                            <div className="space-y-2 mt-2">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        )}
                        
                        {aiInsight && (
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <TrendIcon trend={aiInsight.trend}/>
                                        AI Coach says... (Trend: {aiInsight.trend})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground italic whitespace-pre-wrap">"{aiInsight.feedback}"</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
        <AllLogsDialog open={allLogsOpen} onOpenChange={setAllLogsOpen} tracker={tracker} />
        </>
    );
}