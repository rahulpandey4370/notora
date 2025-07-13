'use client';

import Header from "./Header";
import Sidebar from "./Sidebar";
import type { User } from "@/lib/types";

interface AppLayoutProps {
    user: User | null;
    children: React.ReactNode;
}

export default function AppLayout({ user, children }: AppLayoutProps) {
    // A dummy implementation for tasks and stats for the header
    // In a real app, this would come from a global state or context
    const dummyData = {
        tasks: [],
        userStats: { xp: 0 },
        onDataChange: () => {},
    }

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             <Header 
                user={user} 
                tasks={dummyData.tasks} 
                userStats={dummyData.userStats} 
                onDataChange={dummyData.onDataChange}
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
