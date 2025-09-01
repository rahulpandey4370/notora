'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { CalendarIcon, Loader2, Wand2, ArrowDown, ArrowUp, User as UserIcon } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { analyzeDailyCalories, type AnalyzeDailyCaloriesOutput } from '@/ai/flows/analyze-daily-calories';
import type { Task } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

interface AICalorieCoachProps {
  getCompletedTasksForDate: (date: Date) => Task[];
  getCalorieIntakeForDate: (date: Date) => number | undefined;
  weeklyCalorieData: { date: string; calories?: number }[];
}

interface UserStats {
  age: string;
  gender: 'male' | 'female';
  weight: string;
  height: string;
}

export default function AICalorieCoach({ 
    getCompletedTasksForDate, 
    getCalorieIntakeForDate,
    weeklyCalorieData 
}: AICalorieCoachProps) {
  const [stats, setStats] = useState<UserStats>({
    age: '',
    gender: 'male',
    weight: '',
    height: '',
  });
  const [date, setDate] = useState<Date>(startOfToday());
  const [analysis, setAnalysis] = useState<AnalyzeDailyCaloriesOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedStats = localStorage.getItem('notora-user-stats');
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, []);

  const handleStatChange = (key: keyof UserStats, value: string) => {
    const newStats = { ...stats, [key]: value };
    setStats(newStats);
    localStorage.setItem('notora-user-stats', JSON.stringify(newStats));
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
                    <Input id="weight" type="number" placeholder="e.g., 70" value={stats.weight} onChange={(e) => handleStatChange('weight', e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input id="height" type="number" placeholder="e.g., 175" value={stats.height} onChange={(e) => handleStatChange('height', e.target.value)} />
                </div>
            </div>
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
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Analysis for {format(date, 'MMM d, yyyy')}</CardTitle>
                <CardDescription>{analysis.summary}</CardDescription>
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
