'use client';

import { useState } from 'react';
import type { SavedLink } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Save, X, ExternalLink } from 'lucide-react';
import { linkCategories } from '@/lib/types';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface LinkCardProps {
  link: SavedLink;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Omit<SavedLink, 'id'>>) => void;
}

const categoryColors: Record<typeof linkCategories[number], string> = {
    Article: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-300 dark:border-blue-500/50",
    Video: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-300 dark:border-red-500/50",
    Course: "bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-300 dark:border-purple-500/50",
    Image: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-300 dark:border-orange-500/50",
    Other: "bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-300 dark:border-gray-500/50",
};

export default function LinkCard({ link, onDelete, onUpdate }: LinkCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(link.title);
    const [editedSummary, setEditedSummary] = useState(link.summary);
    const [editedCategory, setEditedCategory] = useState(link.category);
    
    const getFaviconUrl = (url: string) => {
        try {
            const { hostname } = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        } catch (error) {
            return "https://placehold.co/32x32.png";
        }
    };

    const getYouTubeVideoId = (url: string): string | null => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    const videoId = getYouTubeVideoId(link.url);

    const handleSave = () => {
        onUpdate(link.id, {
            title: editedTitle,
            summary: editedSummary,
            category: editedCategory,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedTitle(link.title);
        setEditedSummary(link.summary);
        setEditedCategory(link.category);
        setIsEditing(false);
    };

    return (
        <Card className="flex flex-col h-full">
            {videoId && !isEditing ? (
                <div className='aspect-video w-full rounded-t-lg overflow-hidden'>
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className='w-full h-full'
                    ></iframe>
                </div>
            ) : (
                <CardHeader>
                    {isEditing ? (
                         <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="text-base font-semibold" />
                    ) : (
                        <CardTitle className="flex items-start gap-3 text-base">
                            <img src={getFaviconUrl(link.url)} alt="favicon" className="w-8 h-8 mt-1 rounded-md flex-shrink-0" />
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 break-words">
                                {link.title}
                            </a>
                        </CardTitle>
                    )}
                </CardHeader>
            )}
        
            <CardContent className={`flex-1 ${videoId && !isEditing ? 'pt-6' : ''}`}>
                {isEditing ? (
                    <Textarea value={editedSummary} onChange={(e) => setEditedSummary(e.target.value)} className="text-sm h-24" />
                ) : (
                    <p className="text-sm text-muted-foreground">{link.summary}</p>
                )}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                    {isEditing ? (
                        <Select value={editedCategory} onValueChange={(v: typeof linkCategories[number]) => setEditedCategory(v)}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {linkCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Badge variant="outline" className={categoryColors[link.category] || categoryColors.Other}>
                            {link.category}
                        </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Added: {new Date(link.dateAdded).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {isEditing ? (
                        <>
                            <Button variant="ghost" size="icon" onClick={handleSave} className="text-green-500 hover:text-green-500">
                                <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleCancel} className="text-destructive hover:text-destructive">
                                <X className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-foreground">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete(link.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
