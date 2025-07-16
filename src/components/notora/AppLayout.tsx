'use client';

import { useAuth } from "@/hooks/use-auth";
import Header from "./Header";
import { useApp } from "@/hooks/use-app";
import Dock from "./Dock";
import type { AppData } from "@/lib/types";

interface AppLayoutProps {
    children: React.ReactNode;
    data?: AppData | null;
}

export default function AppLayout({ children, data: dataFromProp }: AppLayoutProps) {
    const { user } = useAuth();
    const { data: dataFromContext } = useApp();
    
    // Use data from props if available (for showcase), otherwise use data from context
    const data = dataFromProp !== undefined ? dataFromProp : dataFromContext;
    
    const tasks = data?.tasks || [];
    const userStats = data?.userStats || { xp: 0 };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             <Header 
                user={user} 
                tasks={tasks} 
                userStats={userStats}
            />
            <div className="flex-1 flex pb-20">
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
            <Dock />
        </div>
    );
}
