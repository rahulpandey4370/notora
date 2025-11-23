
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useWritingSettings } from '@/hooks/use-writing-settings';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface WritingSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WritingSettingsPanel({ open, onOpenChange }: WritingSettingsPanelProps) {
  const { font, size, spacing, setFont, setSize, setSpacing, rawFont } = useWritingSettings();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Writing Environment</SheetTitle>
          <SheetDescription>
            Customize your writing space for maximum comfort and focus.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-8 py-8">
          <div className="space-y-4">
            <Label>Font Family</Label>
            <RadioGroup value={rawFont} onValueChange={(v) => setFont(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="font-body" id="sans" />
                <Label htmlFor="sans">Sans Serif</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="font-serif" id="serif" />
                <Label htmlFor="serif">Serif</Label>
              </div>
               <div className="flex items-center space-x-2">
                <RadioGroupItem value="font-mono" id="mono" />
                <Label htmlFor="mono">Monospace</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Font Size</Label>
              <span className="text-sm text-muted-foreground">{size}px</span>
            </div>
            <Slider
              value={[size]}
              onValueChange={(value) => setSize(value[0])}
              min={12}
              max={24}
              step={1}
            />
          </div>

          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <Label>Line Spacing</Label>
                <span className="text-sm text-muted-foreground">{spacing.toFixed(1)}</span>
             </div>
            <Slider
              value={[spacing]}
              onValueChange={(value) => setSpacing(value[0])}
              min={1.2}
              max={2.5}
              step={0.1}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
