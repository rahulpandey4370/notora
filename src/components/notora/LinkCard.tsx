'use client';

import type { SavedLink } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { linkCategories } from '@/ai/flows/analyze-link';

interface LinkCardProps {
  link: SavedLink;
  onDelete: (id: string) => void;
}

const categoryColors: Record<typeof linkCategories[number], string> = {
    Article: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    Video: "bg-red-500/20 text-red-700 border-red-500/30",
    Course: "bg-purple-500/20 text-purple-700 border-purple-500/30",
    Image: "bg-orange-500/20 text-orange-700 border-orange-500/30",
    Other: "bg-gray-500/20 text-gray-700 border-gray-500/30",
};

export default function LinkCard({ link, onDelete }: LinkCardProps) {
    const getFaviconUrl = (url: string) => {
        try {
            const { hostname } = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        } catch (error) {
            return "https://placehold.co/32x32.png";
        }
    };
    
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-start gap-3 text-base">
          <img src={getFaviconUrl(link.url)} alt="favicon" className="w-8 h-8 mt-1 rounded-md" />
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 break-words">
            {link.title}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground">{link.summary}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
            <Badge variant="outline" className={categoryColors[link.category] || categoryColors.Other}>
                {link.category}
            </Badge>
            <p className="text-xs text-muted-foreground">
            Added: {new Date(link.dateAdded).toLocaleDateString()}
            </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onDelete(link.id)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
