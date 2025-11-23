
'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

interface TagInputProps {
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  allTags: string[];
}

export default function TagInput({ tags, setTags, allTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim() !== '') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setInputValue('');
      setIsPopoverOpen(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const addTag = (tagToAdd: string) => {
    if (!tags.includes(tagToAdd)) {
        setTags([...tags, tagToAdd]);
    }
    setInputValue('');
    setIsPopoverOpen(false);
  }

  const filteredSuggestions = allTags.filter(
    (tag) =>
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(tag)
  );

  return (
    <div>
        <label className="text-sm font-medium mb-2 block">Tags</label>
        <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md min-h-[40px] bg-muted/50">
            {tags.map(tag => (
            <Badge key={tag} variant="secondary">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1 rounded-full hover:bg-background/50">
                <X className="h-3 w-3" />
                </button>
            </Badge>
            ))}
            <Popover open={isPopoverOpen && filteredSuggestions.length > 0} onOpenChange={setIsPopoverOpen}>
                <PopoverAnchor asChild>
                    <Input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            if (e.target.value) setIsPopoverOpen(true);
                            else setIsPopoverOpen(false);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Add a tag..."
                        className="flex-grow bg-transparent border-0 focus-visible:ring-0 p-0 h-auto"
                    />
                </PopoverAnchor>
                <PopoverContent className="w-full p-2">
                    <p className="text-xs text-muted-foreground px-2 mb-1">Suggestions</p>
                    <div className="flex flex-wrap gap-1">
                    {filteredSuggestions.map(suggestion => (
                        <Badge
                            key={suggestion}
                            variant="outline"
                            onClick={() => addTag(suggestion)}
                            className="cursor-pointer"
                        >
                            {suggestion}
                        </Badge>
                    ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    </div>
  );
}
