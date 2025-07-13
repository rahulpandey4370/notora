'use client';

import { useAuth } from "@/hooks/use-auth";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useApp } from "@/hooks/use-app";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user } = useAuth();
    const { data } = useApp();
    
    const tasks = data?.tasks || [];
    const userStats = data?.userStats || { xp: 0 };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             <Header 
                user={user} 
                tasks={tasks} 
                userStats={userStats}
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
