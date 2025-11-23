
'use client';

import { motion } from 'framer-motion';
import { moods, moodEmojiMap, type Mood } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface MoodSelectorProps {
  selectedMood: Mood | undefined;
  onMoodSelect: (mood: Mood) => void;
}

export default function MoodSelector({ selectedMood, onMoodSelect }: MoodSelectorProps) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">How are you feeling?</label>
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {moods.map(mood => (
            <Tooltip key={mood}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => onMoodSelect(mood)}
                  className={cn(
                    'text-3xl p-2 rounded-full transition-all duration-200',
                    selectedMood === mood ? 'bg-primary/20 scale-110' : 'opacity-50 hover:opacity-100 hover:scale-110'
                  )}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {moodEmojiMap[mood]}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{mood}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
