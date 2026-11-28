
'use client';

import { useRef, useState, useMemo } from 'react';
import type { AppData, SavedLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, X, Cpu } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { analyzeLink } from '@/ai/flows/analyze-link';
import { searchLinks } from '@/ai/flows/search-links';
import { linkCategories } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import LinkCard from './LinkCard';
import { motion } from 'framer-motion';
import { useModelFor } from '@/hooks/use-model-store';

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
  const selectedModel = useModelFor('tasks');
  // The latest data, so Undo restores into what's current (not a snapshot from before the delete).
  const latest = useRef({ data, onDataChange });
  latest.current = { data, onDataChange };

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

    // Show it straight away; the AI fills in title, summary and category behind it.
    const url = newUrl.trim();
    const id = uuidv4();
    const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
    const placeholder: SavedLink = { id, url, title: host, summary: 'Analyzing…', category: 'Other', dateAdded: new Date().toISOString() };
    onDataChange({ ...data, savedLinks: [placeholder, ...(data.savedLinks || [])] });
    setNewUrl('');
    // Patch only this link in whatever the data is by then (other edits made meanwhile are kept).
    const patch = (p: Partial<SavedLink>) => {
      const { data: cur, onDataChange: save } = latest.current;
      if (!(cur.savedLinks || []).some(l => l.id === id)) return; // deleted meanwhile
      save({ ...cur, savedLinks: (cur.savedLinks || []).map(l => (l.id === id ? { ...l, ...p } : l)) });
    };
    try {
      const result = await analyzeLink({ url }, selectedModel);
      patch({ title: result.title, summary: result.summary, category: result.category, model: result.modelId });
    } catch (error) {
      console.error('Failed to analyze link:', error);
      patch({ summary: 'Couldn’t analyze this link. It’s saved; tap edit to add a title and notes.' });
      toast({ variant: 'destructive', title: 'Saved, but not analyzed', description: 'The link is in your list. Tap edit to add details, or try adding it again later.' });
    }
  };

  const handleDeleteLink = (id: string) => {
    const links = data.savedLinks || [];
    const index = links.findIndex(l => l.id === id);
    if (index === -1) return;
    const removed = links[index];
    onDataChange({ ...data, savedLinks: links.filter(l => l.id !== id) });
    const restore = () => {
      const { data: cur, onDataChange: save } = latest.current;
      const now = cur.savedLinks || [];
      if (now.some(l => l.id === id)) return;
      save({ ...cur, savedLinks: [...now.slice(0, index), removed, ...now.slice(index)] });
    };
    toast({ title: 'Link deleted', description: removed.title || removed.url, action: <ToastAction altText="Undo delete" onClick={restore}>Undo</ToastAction> });
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

    