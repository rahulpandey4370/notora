
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { CalendarIcon, Loader2, Wand2, ArrowDown, ArrowUp, User as UserIcon, Info, LogIn, Camera, UtensilsCrossed, Sparkles } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { analyzeDailyCalories, type AnalyzeDailyCaloriesOutput } from '@/ai/flows/analyze-daily-calories';
import { analyzeFoodCalories, type AnalyzeFoodCaloriesOutput } from '@/ai/flows/analyze-food-calories';
import type { Task, AppData, LogTracker, LogEntry } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';
import { useApp } from '@/hooks/use-app';
import { v4 as uuidv4 } from 'uuid';
import { useShowcase } from '@/contexts/showcase-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface AICalorieCoachProps {
  getCompletedTasksForDate: (date: Date) => Task[];
  getCalorieIntakeForDate: (date: Date) => number | undefined;
  getStepsForDate: (date: Date) => number | undefined;
  weeklyChartData: { date: string; intake?: number, burned?: number }[];
}

interface UserStats {
  age: string;
  gender: 'male' | 'female';
  weight: string;
  height: string;
}

interface MealAnalysis {
  output: AnalyzeFoodCaloriesOutput;
  image?: string;
}

function useCalorieCoachData() {
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
    weeklyChartData 
}: AICalorieCoachProps) {
  const { data, handleDataChange } = useCalorieCoachData();
  const [stats, setStats] = useState<UserStats>({
    age: '',
    gender: 'male',
    weight: '',
    height: '',
  });
  const [date, setDate] = useState<Date>(startOfToday());

  // Balance Analysis state
  const [balanceOtherActivities, setBalanceOtherActivities] = useState('');
  const [balanceAnalysis, setBalanceAnalysis] = useState<AnalyzeDailyCaloriesOutput | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Meal Logging state
  const [mealDescription, setMealDescription] = useState('');
  const [mealImage, setMealImage] = useState<string | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null);
  const [mealLoading, setMealLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { weight, ...statsToSave } = newStats;
      localStorage.setItem('notora-user-stats', JSON.stringify(statsToSave));
      return newStats;
    });
  };

  const handleAnalyzeBalance = async () => {
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

    setBalanceLoading(true);
    setBalanceAnalysis(null);

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
        otherActivities: balanceOtherActivities,
      });
      setBalanceAnalysis(result);
    } catch (error) {
      console.error('Failed to analyze calories:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'Could not perform the calorie balance analysis. Please try again.',
      });
    } finally {
      setBalanceLoading(false);
    }
  };
  
  const handleLogData = (trackerName: string, value: number, notes: string) => {
    if (!data) return;

    let tracker = data.logTrackers.find(t => t.name === trackerName);
    let updatedTrackers: LogTracker[];
    const logDate = format(date, 'yyyy-MM-dd');
    
    const newLogEntry: LogEntry = {
      id: uuidv4(),
      date: logDate,
      value: value,
      notes: notes
    };

    if (tracker) {
      updatedTrackers = data.logTrackers.map(t => {
        if (t.id === tracker?.id) {
          const existingLogIndex = t.logs.findIndex(l => l.date === logDate);
          let newLogs: LogEntry[];
          if (existingLogIndex > -1) {
            newLogs = [...t.logs];
            const existingLog = newLogs[existingLogIndex];
            newLogs[existingLogIndex] = { ...existingLog, value: existingLog.value + value };
            toast({ title: "Log Updated", description: `Added ${value} kcal to your intake for ${format(date, 'PPP')}.` });
          } else {
            newLogs = [...t.logs, newLogEntry];
            toast({ title: "Log Added", description: `${value} kcal logged as '${trackerName}' for ${format(date, 'PPP')}.` });
          }
          return { ...t, logs: newLogs };
        }
        return t;
      });
    } else {
      const newTracker: LogTracker = {
        id: uuidv4(),
        name: trackerName,
        unit: 'kcal',
        logs: [newLogEntry],
        isFlippable: true,
      };
      updatedTrackers = [...data.logTrackers, newTracker];
      toast({ title: "Tracker Created & Log Added", description: `${value} kcal logged for ${format(date, 'PPP')}.` });
    }

    handleDataChange({ ...data, logTrackers: updatedTrackers });
  };

  const handleLogTotalBurn = () => {
    if (!balanceAnalysis) return;
    handleLogData("Calories Burned", balanceAnalysis.totalCalorieBurn, 'AI-estimated total burn');
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setMealImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleAnalyzeMeal = async () => {
    if (!mealDescription && !mealImage) {
        toast({ variant: 'destructive', title: 'No Input', description: 'Please describe your meal or upload an image.' });
        return;
    }
    setMealLoading(true);
    setMealAnalysis(null);

    try {
        const result = await analyzeFoodCalories({
            foodDescription: mealDescription,
            foodImage: mealImage,
        });
        setMealAnalysis({ output: result, image: mealImage || undefined });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Analysis Failed', description: 'Could not analyze your meal. Please try again.'});
    } finally {
        setMealLoading(false);
    }
  };

  const handleLogMealCalories = () => {
    if (!mealAnalysis) return;
    handleLogData('Daily Calorie Intake', mealAnalysis.output.totalCalories, mealAnalysis.output.items.map(i => i.name).join(', '));
  }

  const { weeklyNet, weeklyIntake, weeklyBurn } = useMemo(() => {
    return weeklyChartData.reduce((acc, day) => {
        acc.weeklyIntake += day.intake || 0;
        acc.weeklyBurn += day.burned || 0;
        acc.weeklyNet = acc.weeklyIntake - acc.weeklyBurn;
        return acc;
    }, { weeklyNet: 0, weeklyIntake: 0, weeklyBurn: 0 });
  }, [weeklyChartData]);

  return (
    <Card className="dark:neon-border-green">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary" /> AI Calorie Coach</CardTitle>
        <CardDescription>
          Analyze your daily balance or log a meal using AI to estimate calories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="analyze-balance">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="analyze-balance">Analyze Balance</TabsTrigger>
                <TabsTrigger value="log-meal">Log a Meal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analyze-balance" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
                        <h4 className="font-semibold flex items-center gap-2"><UserIcon className="w-4 h-4"/>Your Stats for {format(date, 'PPP')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="age">Age</Label>
                                <Input id="age" type="number" placeholder="e.g., 30" value={stats.age} onChange={(e) => handleStatChange('age', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={stats.gender} onValueChange={(v) => handleStatChange('gender', v as 'male' | 'female')}>
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
                        <p className="text-xs text-muted-foreground">Your age, height, and gender are saved locally. Weight is fetched from your logs for the selected date if available.</p>
                        </div>
                        
                        <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                        <Label htmlFor="other-activities">Other Activities for {format(date, 'PPP')}</Label>
                        <Textarea 
                            id="other-activities"
                            placeholder="e.g., 30 minute run, 1 hour of weightlifting..."
                            value={balanceOtherActivities}
                            onChange={(e) => setBalanceOtherActivities(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            The AI will use your logged steps and any activities you describe here.
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
                        <Button onClick={handleAnalyzeBalance} disabled={balanceLoading} className="w-full">
                            {balanceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Analyze Day
                        </Button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {balanceLoading && (
                            <div className="p-4 rounded-lg border bg-muted/50 space-y-3 mt-4 h-full flex flex-col justify-center">
                                <Skeleton className="h-5 w-3/4 mx-auto" />
                                <div className="flex justify-around items-end pt-4">
                                    <Skeleton className="h-16 w-16 rounded-md" />
                                    <Skeleton className="h-24 w-16 rounded-md" />
                                    <Skeleton className="h-20 w-16 rounded-md" />
                                </div>
                            </div>
                        )}

                        {!balanceLoading && balanceAnalysis && (
                            <Card className="bg-muted/50">
                                <CardHeader className="pb-2 relative">
                                    <CardTitle className="text-lg">Analysis for {format(date, 'MMM d, yyyy')}</CardTitle>
                                    <CardDescription>{balanceAnalysis.summary}</CardDescription>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2">
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">Calculation Breakdown</h4>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{balanceAnalysis.reasoning}</p>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </CardHeader>
                                <CardContent className="flex justify-around text-center">
                                    <div className="p-2">
                                        <p className="text-xs text-muted-foreground">Maintenance</p>
                                        <p className="text-2xl font-bold">{balanceAnalysis.maintenanceCalories}</p>
                                        <p className="text-xs text-muted-foreground">kcal</p>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs text-muted-foreground">Total Burn</p>
                                        <p className="text-2xl font-bold">{balanceAnalysis.totalCalorieBurn}</p>
                                        <p className="text-xs text-muted-foreground">kcal</p>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs text-muted-foreground">Net Balance</p>
                                        <p className={`text-2xl font-bold flex items-center justify-center gap-1 ${balanceAnalysis.netCalories > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {balanceAnalysis.netCalories > 0 ? <ArrowUp /> : <ArrowDown /> }
                                            {Math.abs(balanceAnalysis.netCalories)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{balanceAnalysis.netCalories > 0 ? 'Surplus' : 'Deficit'}</p>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" className="w-full" onClick={handleLogTotalBurn}>
                                    <LogIn className="mr-2 h-4 w-4" /> Log Total Burn
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                        
                        <h4 className="font-semibold pt-4">Last 7 Days: Intake vs. Burn</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={weeklyChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
                                <Legend iconType='circle' iconSize={8} />
                                {balanceAnalysis?.maintenanceCalories && (
                                    <ReferenceLine 
                                    y={balanceAnalysis.maintenanceCalories} 
                                    label={{ value: 'Maintenance', position: 'insideTopLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                                    stroke="hsl(var(--primary))" 
                                    strokeDasharray="3 3" 
                                    />
                                )}
                                <Bar dataKey="intake" name="Intake" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="burned" name="Burned" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        {weeklyIntake > 0 && weeklyBurn > 0 && (
                            <div className="text-center font-semibold">
                                Weekly Net: 
                                <span className={cn('ml-2', weeklyNet > 0 ? 'text-red-500' : 'text-green-500')}>
                                    {weeklyNet > 0 ? '+' : ''}{weeklyNet.toFixed(0)} kcal
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="log-meal" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="meal-description">Meal Description</Label>
                            <Textarea id="meal-description" placeholder="e.g., 1 bowl of dal, 2 rotis, and a side of salad" value={mealDescription} onChange={e => setMealDescription(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Or Upload an Image</Label>
                            <div className='flex gap-2 items-center'>
                                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                    <Camera className="mr-2 h-4 w-4" /> Choose Image
                                </Button>
                                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </div>
                        </div>
                        <Button onClick={handleAnalyzeMeal} disabled={mealLoading} className="w-full">
                            {mealLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />}
                            Estimate Meal Calories
                        </Button>
                    </div>
                     <div className="space-y-4">
                        {mealLoading && (
                            <Card className="bg-muted/50 flex items-center justify-center h-full">
                                <div className="text-center text-muted-foreground p-8">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2"/>
                                    <p>Analyzing your meal...</p>
                                </div>
                            </Card>
                        )}
                        {!mealLoading && mealAnalysis && (
                             <Card className="bg-muted/50">
                                <CardHeader className="pb-2 relative">
                                    <CardTitle className="text-lg">Meal Analysis</CardTitle>
                                    <CardDescription>{mealAnalysis.output.reasoning}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {mealAnalysis.image && <img src={mealAnalysis.image} alt="Analyzed meal" data-ai-hint="food meal" className="rounded-lg object-cover w-full aspect-video" />}
                                    <div className="flex justify-between items-center text-center">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Calories</p>
                                            <p className="text-2xl font-bold">{mealAnalysis.output.totalCalories}</p>
                                        </div>
                                         <div>
                                            <p className="text-xs text-muted-foreground">Items Found</p>
                                            <p className="text-2xl font-bold">{mealAnalysis.output.items.length}</p>
                                        </div>
                                    </div>
                                    <ul className="text-sm space-y-1">
                                        {mealAnalysis.output.items.map(item => (
                                            <li key={item.name} className="flex justify-between">
                                                <span>{item.name}</span>
                                                <span className="font-semibold">{item.calories} kcal</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" className="w-full" onClick={handleLogMealCalories}>
                                        <LogIn className="mr-2 h-4 w-4" /> Log Meal Calories
                                    </Button>
                                </CardFooter>
                             </Card>
                        )}
                         {!mealLoading && !mealAnalysis && (
                            <Card className="bg-muted/50 flex items-center justify-center h-full">
                                <div className="text-center text-muted-foreground p-8">
                                    <UtensilsCrossed className="mx-auto h-8 w-8 mb-2" />
                                    <p>Your meal analysis will appear here.</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
