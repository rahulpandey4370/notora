
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { journalTemplates, type JournalTemplate } from '@/lib/types';
import { Button } from '../ui/button';
import { BookCheck } from 'lucide-react';

interface TemplateChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateContent: string) => void;
}

export default function TemplateChooser({ open, onOpenChange, onSelectTemplate }: TemplateChooserProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a Journal Template</DialogTitle>
          <DialogDescription>
            Select a template to guide your writing and structure your thoughts.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] -mx-6 px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {journalTemplates.map((template) => (
              <Card key={template.title} className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <CardDescription className="text-xs">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onSelectTemplate(template.content)}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
