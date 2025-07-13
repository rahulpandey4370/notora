'use client';

import { useState, useEffect } from 'react';
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { AppData, User } from "@/lib/types";
import { getAppData } from '@/lib/storage';

interface AppLayoutProps {
    user: User | null;
    children: React.ReactNode;
}

export default function AppLayout({ user, children }: AppLayoutProps) {
    const [data, setData] = useState<AppData | null>(null);

    useEffect(() => {
        if (user) {
            getAppData(user.username).then(setData);
        }
    }, [user]);

    const tasks = data?.tasks || [];
    const userStats = data?.userStats || { xp: 0 };
    
    const handleDataChange = (newData: AppData) => {
        // This is a dummy handler for components that need it but AppLayout is now main data source
        // Actual data saving is handled in pages
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             <Header 
                user={user} 
                tasks={tasks} 
                userStats={userStats}
                onDataChange={handleDataChange}
            />
            <div className="flex-1 flex">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
