
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { CalendarIcon, Loader2, Wand2, ArrowDown, ArrowUp, User as UserIcon, Info, LogIn } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { analyzeDailyCalories, type AnalyzeDailyCaloriesOutput } from '@/ai/flows/analyze-daily-calories';
import type { Task, AppData, LogTracker, LogEntry } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { useApp } from '@/hooks/use-app';
import { v4 as uuidv4 } from 'uuid';
import { useShowcase } from '@/contexts/showcase-context';


interface AICalorieCoachProps {
  getCompletedTasksForDate: (date: Date) => Task[];
  getCalorieIntakeForDate: (date: Date) => number | undefined;
  getStepsForDate: (date: Date) => number | undefined;
  weeklyCalorieData: { date: string; calories?: number }[];
}

interface UserStats {
  age: string;
  gender: 'male' | 'female';
  weight: string;
  height: string;
}

function useCalorieCoachData() {
  // A bit of a trick to use hooks conditionally, not ideal but works for this case.
  // In a real app, you might structure this differently.
  try {
    const app = useApp();
    return {
      data: app.data,
      handleDataChange: app.handleDataChange,
      isShowcase: false
    };
  } catch (e) {
    const showcase = useShowcase();
    return {
      data: showcase.data,
      handleDataChange: showcase.handleDataChange,
      isShowcase: true
    };
  }
}

export default function AICalorieCoach({ 
    getCompletedTasksForDate, 
    getCalorieIntakeForDate,
    getStepsForDate,
    weeklyCalorieData 
}: AICalorieCoachProps) {
  const { data, handleDataChange } = useCalorieCoachData();
  const [stats, setStats] = useState<UserStats>({
    age: '',
    gender: 'male',
    weight: '',
    height: '',
  });
  const [date, setDate] = useState<Date>(startOfToday());
  const [otherActivities, setOtherActivities] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeDailyCaloriesOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedStats = localStorage.getItem('notora-user-stats');
    if (savedStats) {
      const parsedStats = JSON.parse(savedStats);
      setStats(prevStats => ({...prevStats, ...parsedStats}));
    }
  }, []);

  // Effect to update weight from logs when date changes
  useEffect(() => {
    if (!data) return;
    const weightTracker = data.logTrackers.find(t => t.name === 'Weight');
    if (!weightTracker) return;

    const logForDate = weightTracker.logs.find(l => l.date === format(date, 'yyyy-MM-dd'));
    if (logForDate) {
      handleStatChange('weight', String(logForDate.value));
    }

  }, [date, data]);

  const handleStatChange = (key: keyof UserStats, value: string) => {
    setStats(prevStats => {
      const newStats = { ...prevStats, [key]: value };
      // Save all stats except weight, as it's date-dependent
      const { weight, ...statsToSave } = newStats;
      localStorage.setItem('notora-user-stats', JSON.stringify(statsToSave));
      return newStats;
    });
  };

  const handleAnalyze = async () => {
    const { age, gender, weight, height } = stats;
    if (!age || !weight || !height) {
      toast({
        variant: 'destructive',
        title: 'Missing Stats',
        description: 'Please fill in your age, gender, weight, and height to get an analysis.',
      });
      return;
    }
    
    const calorieIntake = getCalorieIntakeForDate(date);
    if (calorieIntake === undefined) {
        toast({
            variant: 'destructive',
            title: 'No Calorie Log',
            description: `Please log your calorie intake for ${format(date, 'PPP')} to get an analysis.`,
        });
        return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const result = await analyzeDailyCalories({
        stats: {
          age: parseInt(age),
          gender,
          weight: parseFloat(weight),
          height: parseFloat(height),
        },
        tasks: getCompletedTasksForDate(date),
        calorieIntake: calorieIntake,
        steps: getStepsForDate(date),
        otherActivities,
      });
      setAnalysis(result);
    } catch (error) {
      console.error('Failed to analyze calories:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'Could not perform the calorie analysis. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogTotalBurn = () => {
    if (!analysis || !data) return;

    const trackerName = "Calories Burned";
    let tracker = data.logTrackers.find(t => t.name === trackerName);
    let updatedTrackers: LogTracker[];

    const logDate = format(date, 'yyyy-MM-dd');
    const newLogEntry: LogEntry = {
      id: uuidv4(),
      date: logDate,
      value: analysis.totalCalorieBurn,
      notes: 'AI-estimated burn'
    };

    if (tracker) {
      // Tracker exists, add or update log
      updatedTrackers = data.logTrackers.map(t => {
        if (t.id === tracker?.id) {
          const existingLogIndex = t.logs.findIndex(l => l.date === logDate);
          let newLogs: LogEntry[];
          if (existingLogIndex > -1) {
            newLogs = [...t.logs];
            newLogs[existingLogIndex] = { ...newLogs[existingLogIndex], value: analysis.totalCalorieBurn };
          } else {
            newLogs = [...t.logs, newLogEntry];
          }
          return { ...t, logs: newLogs };
        }
        return t;
      });
    } else {
      // Tracker does not exist, create it
      const newTracker: LogTracker = {
        id: uuidv4(),
        name: trackerName,
        unit: 'kcal',
        logs: [newLogEntry],
        isFlippable: true,
      };
      updatedTrackers = [...data.logTrackers, newTracker];
    }

    handleDataChange({ ...data, logTrackers: updatedTrackers });
    toast({
      title: "Log Saved",
      description: `${analysis.totalCalorieBurn} kcal logged as 'Calories Burned' for ${format(date, 'PPP')}.`
    });
  };

  const weeklyNet = weeklyCalorieData.reduce((acc, day) => acc + (day.calories || 0), 0) - (analysis ? analysis.maintenanceCalories * 7 : 0);

  return (
    <Card className="dark:neon-border-green">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wand2 className="text-primary" /> AI Calorie Coach</CardTitle>
        <CardDescription>
          Get an AI-powered analysis of your daily calorie balance based on your logs and activities.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
            <h4 className="font-semibold flex items-center gap-2"><UserIcon className="w-4 h-4"/>Your Stats</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" type="number" placeholder="e.g., 30" value={stats.age} onChange={(e) => handleStatChange('age', e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={stats.gender} onValueChange={(v) => handleStatChange('gender', v)}>
                    <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input id="weight" type="number" placeholder="Logged or manual" value={stats.weight} onChange={(e) => handleStatChange('weight', e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input id="height" type="number" placeholder="e.g., 175" value={stats.height} onChange={(e) => handleStatChange('height', e.target.value)} />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">Your age, height, and gender are saved. Your weight is fetched from your logs for the selected date.</p>
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
            <Label htmlFor="other-activities">Other Activities</Label>
            <Textarea 
                id="other-activities"
                placeholder="e.g., 30 minute run, 1 hour of weightlifting..."
                value={otherActivities}
                onChange={(e) => setOtherActivities(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
                The AI will consider steps logged in your 'Steps' tracker and any activities you describe here.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={handleAnalyze} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Analyze Day
            </Button>
          </div>

          {loading && (
            <div className="p-4 rounded-lg border bg-muted/50 space-y-3 mt-4">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex justify-around items-end pt-4">
                    <Skeleton className="h-16 w-16 rounded-md" />
                    <Skeleton className="h-24 w-16 rounded-md" />
                    <Skeleton className="h-20 w-16 rounded-md" />
                </div>
            </div>
          )}

          {analysis && (
            <Card className="bg-muted/50">
                <CardHeader className="pb-2 relative">
                    <CardTitle className="text-lg">Analysis for {format(date, 'MMM d, yyyy')}</CardTitle>
                    <CardDescription>{analysis.summary}</CardDescription>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2">
                                <Info className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Calculation Breakdown</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis.reasoning}</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                </CardHeader>
                <CardContent className="flex justify-around text-center">
                    <div className="p-2">
                        <p className="text-xs text-muted-foreground">Maintenance</p>
                        <p className="text-2xl font-bold">{analysis.maintenanceCalories}</p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                    </div>
                    <div className="p-2">
                        <p className="text-xs text-muted-foreground">Total Burn</p>
                        <p className="text-2xl font-bold">{analysis.totalCalorieBurn}</p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                    </div>
                    <div className="p-2">
                        <p className="text-xs text-muted-foreground">Net Balance</p>
                        <p className={`text-2xl font-bold flex items-center justify-center gap-1 ${analysis.netCalories > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {analysis.netCalories > 0 ? <ArrowUp /> : <ArrowDown /> }
                            {Math.abs(analysis.netCalories)}
                        </p>
                        <p className="text-xs text-muted-foreground">{analysis.netCalories > 0 ? 'Surplus' : 'Deficit'}</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" className="w-full" onClick={handleLogTotalBurn}>
                       <LogIn className="mr-2 h-4 w-4" /> Log Total Burn
                    </Button>
                </CardFooter>
            </Card>
          )}

        </div>

        <div className="space-y-4">
            <h4 className="font-semibold">Last 7 Days Intake vs. Maintenance</h4>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyCalorieData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                    <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM d')} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))'
                        }}
                        labelFormatter={(label) => format(new Date(label), 'PPP')}
                    />
                    {analysis?.maintenanceCalories && (
                         <ReferenceLine y={analysis.maintenanceCalories} label={{ value: 'Maintenance', position: 'insideTopLeft' }} stroke="hsl(var(--primary))" strokeDasharray="3 3" />
                    )}
                    <Bar dataKey="calories" name="Calorie Intake">
                        {weeklyCalorieData.map((entry, index) => (
                           <Bar key={`cell-${index}`} fill={cn(entry.calories && analysis && entry.calories > analysis.maintenanceCalories ? 'hsl(var(--destructive))' : 'hsl(var(--chart-2))')} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            {analysis && (
                 <div className="text-center font-semibold">
                    Weekly Net: 
                    <span className={cn('ml-2', weeklyNet > 0 ? 'text-red-500' : 'text-green-500')}>
                         {weeklyNet > 0 ? '+' : ''}{weeklyNet.toFixed(0)} kcal
                    </span>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
