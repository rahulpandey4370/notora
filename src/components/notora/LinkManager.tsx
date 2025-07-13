'use client';

import { useState } from 'react';
import type { AppData, SavedLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { analyzeLink, linkCategories } from '@/ai/flows/analyze-link';
import { useToast } from '@/hooks/use-toast';
import LinkCard from './LinkCard';

interface LinkManagerProps {
  savedLinks: SavedLink[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function LinkManager({ savedLinks, data, onDataChange }: LinkManagerProps) {
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAddLink = async () => {
    if (!newUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(newUrl);
    } catch (_) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL',
        description: 'Please enter a valid URL.',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeLink({ url: newUrl });
      const newLink: SavedLink = {
        id: uuidv4(),
        url: newUrl,
        title: result.title,
        summary: result.summary,
        category: result.category,
        dateAdded: new Date().toISOString(),
      };

      const updatedLinks = [newLink, ...(data.savedLinks || [])];
      onDataChange({ ...data, savedLinks: updatedLinks });
      setNewUrl('');

      toast({
        title: 'Link Saved!',
        description: `"${result.title}" has been added to your collection.`,
      });
    } catch (error) {
      console.error('Failed to analyze link:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'Could not analyze the provided link. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = (id: string) => {
    const updatedLinks = (data.savedLinks || []).filter((link) => link.id !== id);
    onDataChange({ ...data, savedLinks: updatedLinks });
  };
  
  const filteredLinks = activeFilter
    ? savedLinks.filter(link => link.category === activeFilter)
    : savedLinks;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <Input
          placeholder="Paste a URL to save and analyze..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
          className="w-full"
          disabled={loading}
        />
        <Button onClick={handleAddLink} className="w-full sm:w-auto" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add Link
        </Button>
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <Button 
            variant={activeFilter === null ? 'default' : 'outline'}
            onClick={() => setActiveFilter(null)}
        >
            All
        </Button>
        {linkCategories.map(category => (
            <Button 
                key={category} 
                variant={activeFilter === category ? 'default' : 'outline'}
                onClick={() => setActiveFilter(category)}
            >
                {category}
            </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLinks.map((link) => (
          <LinkCard key={link.id} link={link} onDelete={handleDeleteLink} />
        ))}
      </div>
      {savedLinks.length === 0 && !loading && (
        <p className="text-center text-muted-foreground pt-10">
          Save your first link to get started!
        </p>
      )}
       {filteredLinks.length === 0 && savedLinks.length > 0 && (
         <p className="text-center text-muted-foreground pt-10">
            No links found for the "{activeFilter}" category.
        </p>
       )}
    </div>
  );
}
