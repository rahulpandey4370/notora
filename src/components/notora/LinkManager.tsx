
'use client';

import { useState, useMemo } from 'react';
import type { AppData, SavedLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, X, Cpu } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { analyzeLink } from '@/ai/flows/analyze-link';
import { searchLinks } from '@/ai/flows/search-links';
import { linkCategories } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import LinkCard from './LinkCard';
import { motion } from 'framer-motion';
import { useModelStore } from '@/hooks/use-model-store';

interface LinkManagerProps {
  savedLinks: SavedLink[];
  data: AppData;
  onDataChange: (data: AppData) => void;
}

export default function LinkManager({ savedLinks, data, onDataChange }: LinkManagerProps) {
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedLinkIds, setSearchedLinkIds] = useState<string[] | null>(null);
  const [searchModel, setSearchModel] = useState<string | undefined>();
  const { toast } = useToast();
  const { selectedModel } = useModelStore();

  const handleAddLink = async () => {
    if (!newUrl.trim()) return;

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
      const result = await analyzeLink({ url: newUrl }, selectedModel);
      const newLink: SavedLink = {
        id: uuidv4(),
        url: newUrl,
        title: result.title,
        summary: result.summary,
        category: result.category,
        dateAdded: new Date().toISOString(),
        model: result.modelId,
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
  
  const handleUpdateLink = (id: string, updatedData: Partial<Omit<SavedLink, 'id'>>) => {
    const updatedLinks = (data.savedLinks || []).map((link) => 
      link.id === id ? { ...link, ...updatedData } : link
    );
    onDataChange({ ...data, savedLinks: updatedLinks });
    toast({
        title: 'Link Updated!',
        description: 'Your changes have been saved.',
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      handleClearSearch();
      return;
    }

    setSearchLoading(true);
    try {
      const result = await searchLinks({ query: searchQuery, links: savedLinks }, selectedModel);
      setSearchedLinkIds(result.relevantLinkIds);
      setSearchModel(result.modelId);
    } catch (error) {
      console.error('Failed to search links:', error);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: 'Could not perform the search. Please try again.',
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchedLinkIds(null);
    setSearchModel(undefined);
  };
  
  const filteredLinks = useMemo(() => {
    let linksToDisplay = savedLinks;

    if (searchedLinkIds !== null) {
      const idSet = new Set(searchedLinkIds);
      linksToDisplay = savedLinks.filter(link => idSet.has(link.id))
        .sort((a, b) => searchedLinkIds.indexOf(a.id) - searchedLinkIds.indexOf(b.id));
    }

    if (activeFilter) {
      linksToDisplay = linksToDisplay.filter(link => link.category === activeFilter);
    }

    return linksToDisplay;
  }, [savedLinks, activeFilter, searchedLinkIds]);

  const isSearchActive = searchedLinkIds !== null;

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                <Input
                placeholder="Paste a URL to save and analyze..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                className="w-full nb-border rounded-md h-9"
                disabled={loading}
                />
                <Button onClick={handleAddLink} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground nb-border rounded-md h-9 nb-shadow-sm dark:shadow-[2px_2px_0px_hsl(var(--primary))]" disabled={loading}>
                {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Plus className="mr-2 h-4 w-4" />
                )}
                Add Link
                </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto md:justify-end">
                <Input
                    placeholder="Search your links..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                      if (e.key === 'Escape') {
                        handleClearSearch();
                      }
                    }}
                    className="w-full nb-border rounded-md h-9"
                    disabled={searchLoading}
                />
                 <Button onClick={isSearchActive ? handleClearSearch : handleSearch} variant="outline" className="w-full sm:w-auto nb-border rounded-md h-9 nb-shadow-sm dark:shadow-[2px_2px_0px_hsl(var(--primary))]" disabled={searchLoading}>
                    {searchLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isSearchActive ? (
                        <X className="mr-2 h-4 w-4" />
                    ) : (
                        <Search className="mr-2 h-4 w-4" />
                    )}
                    {isSearchActive ? 'Clear' : 'Search'}
                </Button>
            </div>
        </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <Button 
            variant={activeFilter === null ? 'default' : 'outline'}
            onClick={() => setActiveFilter(null)}
            className="nb-border rounded-md h-9 nb-shadow-sm dark:shadow-[2px_2px_0px_hsl(var(--primary))]"
        >
            All
        </Button>
        {linkCategories.map(category => (
            <Button 
                key={category} 
                variant={activeFilter === category ? 'default' : 'outline'}
                onClick={() => setActiveFilter(category)}
                className="nb-border rounded-md h-9 nb-shadow-sm dark:shadow-[2px_2px_0px_hsl(var(--primary))]"
            >
                {category}
            </Button>
        ))}
      </div>

      {isSearchActive && searchModel && (
        <div className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
            <Cpu className="h-3 w-3" /> Search results by {searchModel}
        </div>
      )}

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredLinks.map((link) => (
          <LinkCard key={link.id} link={link} onDelete={handleDeleteLink} onUpdate={handleUpdateLink} />
        ))}
      </motion.div>
      
      {savedLinks.length > 0 && filteredLinks.length === 0 && (
         <p className="text-center text-muted-foreground pt-10">
            {searchedLinkIds !== null ? `No links found for your search "${searchQuery}".` : `No links found for the "${activeFilter}" category.`}
        </p>
      )}

      {savedLinks.length === 0 && !loading && (
        <p className="text-center text-muted-foreground pt-10">
          Save your first link to get started!
        </p>
      )}
    </div>
  );
}

    