'use client';

import { useState } from 'react';
import type { AppData, Task, TaskTemplate, TaskTemplateBundle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Bookmark, Package, Trash2, Layers, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, getWeek } from 'date-fns';
import { toYmd } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface TaskTemplatesProps {
  data: AppData;
  onDataChange: (data: AppData) => void;
  currentMonth: Date;
  toast?: ReturnType<typeof import('@/hooks/use-toast').useToast>['toast'];
}

const priorityColor: Record<Task['priority'], string> = {
  Easy: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hard: 'bg-red-100 text-red-800',
};

export default function TaskTemplates({ data, onDataChange, currentMonth, toast }: TaskTemplatesProps) {
  const templates = data.taskTemplates || [];
  const bundles = data.taskTemplateBundles || [];

  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('Medium');
  const [newType, setNewType] = useState<Task['type']>('single');

  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleSelected, setBundleSelected] = useState<Set<string>>(new Set());

  const materializeTask = (tpl: TaskTemplate): Task => {
    const now = new Date();
    return {
      id: uuidv4(),
      title: tpl.title,
      priority: tpl.priority,
      type: tpl.type,
      completions: [],
      createdAt: now.toISOString(),
      date: tpl.type === 'single' ? toYmd(now) : undefined,
      month: tpl.type === 'monthly' ? format(currentMonth, 'yyyy-MM') : undefined,
      week: tpl.type === 'weekly' ? `${format(now, 'yyyy')}-${getWeek(now)}` : undefined,
      carryForwardCount: 0,
    };
  };

  const addTemplate = () => {
    if (newTitle.trim() === '') return;
    const tpl: TaskTemplate = {
      id: uuidv4(),
      title: newTitle.trim(),
      priority: newPriority,
      type: newType,
      createdAt: new Date().toISOString(),
    };
    onDataChange({ ...data, taskTemplates: [...templates, tpl] });
    setNewTitle('');
    toast?.({ title: 'Template saved', description: `"${tpl.title}" added to your templates.` });
  };

  const deleteTemplate = (id: string) => {
    const newBundles = bundles
      .map(b => ({ ...b, templateIds: b.templateIds.filter(tid => tid !== id) }))
      .filter(b => b.templateIds.length > 0);
    onDataChange({
      ...data,
      taskTemplates: templates.filter(t => t.id !== id),
      taskTemplateBundles: newBundles,
    });
  };

  const addTemplateAsTask = (tpl: TaskTemplate) => {
    onDataChange({ ...data, tasks: [...data.tasks, materializeTask(tpl)] });
    toast?.({ title: 'Task added', description: `"${tpl.title}" added to your tasks.` });
  };

  const addBundle = () => {
    if (bundleName.trim() === '' || bundleSelected.size === 0) return;
    const bundle: TaskTemplateBundle = {
      id: uuidv4(),
      name: bundleName.trim(),
      templateIds: Array.from(bundleSelected),
      createdAt: new Date().toISOString(),
    };
    onDataChange({ ...data, taskTemplateBundles: [...bundles, bundle] });
    setBundleName('');
    setBundleSelected(new Set());
    setBundleDialogOpen(false);
    toast?.({ title: 'Bundle saved', description: `"${bundle.name}" created with ${bundle.templateIds.length} tasks.` });
  };

  const deleteBundle = (id: string) => {
    onDataChange({ ...data, taskTemplateBundles: bundles.filter(b => b.id !== id) });
  };

  const applyBundle = (bundle: TaskTemplateBundle) => {
    const tasksToAdd = bundle.templateIds
      .map(tid => templates.find(t => t.id === tid))
      .filter((t): t is TaskTemplate => !!t)
      .map(materializeTask);
    if (tasksToAdd.length === 0) return;
    onDataChange({ ...data, tasks: [...data.tasks, ...tasksToAdd] });
    toast?.({ title: 'Bundle applied', description: `Added ${tasksToAdd.length} tasks from "${bundle.name}".` });
  };

  const toggleBundleSelected = (id: string) => {
    const next = new Set(bundleSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBundleSelected(next);
  };

  return (
    <Card className="dark:neon-tasks overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Bookmark className="w-5 h-5 shrink-0" />
                  <span className="truncate">Saved Templates</span>
                  <Badge variant="outline" className="ml-1 text-[10px] shrink-0">
                    {templates.length} / {bundles.length} bundles
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  Save reusable tasks and add them with one click. Templates do not auto-populate each month — your slate stays clean.
                </CardDescription>
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 shrink-0 transition-transform duration-200',
                  open && 'rotate-180'
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-2 items-stretch">
              <Input
                placeholder="Template title (e.g. Pay rent)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                className="w-full nb-border rounded-md h-9 sm:col-span-2 lg:col-span-1"
              />
              <Select value={newType} onValueChange={(v) => setNewType(v as Task['type'])}>
                <SelectTrigger className="w-full lg:w-[120px] nb-border rounded-md h-9 nb-shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Task['priority'])}>
                <SelectTrigger className="w-full lg:w-[120px] nb-border rounded-md h-9 nb-shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={addTemplate}
                className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground nb-border rounded-md h-9 nb-shadow-sm sm:col-span-2 lg:col-span-1"
              >
                <Plus className="mr-2 h-4 w-4" /> Save Template
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Individual templates</h4>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No templates yet. Save one above.</p>
              ) : (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {templates.map(tpl => (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between gap-2 p-2 nb-border rounded-md nb-shadow-sm bg-card min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{tpl.title}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">{tpl.type}</Badge>
                          <Badge className={`text-[10px] ${priorityColor[tpl.priority]}`}>{tpl.priority}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => addTemplateAsTask(tpl)} title="Add as task">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteTemplate(tpl.id)} title="Delete template">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Bundles
                </h4>
                <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={templates.length === 0}>
                      <Package className="w-4 h-4 mr-2" /> New Bundle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create a bundle</DialogTitle>
                      <DialogDescription>Group templates so you can add them all in one click.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="Bundle name (e.g. Start of month)"
                        value={bundleName}
                        onChange={(e) => setBundleName(e.target.value)}
                      />
                      <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
                        {templates.map(tpl => (
                          <label key={tpl.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted rounded min-w-0">
                            <Checkbox
                              checked={bundleSelected.has(tpl.id)}
                              onCheckedChange={() => toggleBundleSelected(tpl.id)}
                            />
                            <span className="flex-1 truncate">{tpl.title}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{tpl.type}</Badge>
                          </label>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={addBundle} disabled={!bundleName.trim() || bundleSelected.size === 0}>
                        Create bundle
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {bundles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No bundles yet. Create one to add many tasks at once.</p>
              ) : (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {bundles.map(bundle => {
                    const count = bundle.templateIds.filter(tid => templates.some(t => t.id === tid)).length;
                    return (
                      <div
                        key={bundle.id}
                        className="flex items-center justify-between gap-2 p-2 nb-border rounded-md nb-shadow-sm bg-card min-w-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{bundle.name}</div>
                          <div className="text-xs text-muted-foreground">{count} task{count === 1 ? '' : 's'}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => applyBundle(bundle)} title="Add all tasks">
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteBundle(bundle.id)} title="Delete bundle">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
