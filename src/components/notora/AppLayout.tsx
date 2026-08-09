'use client';

import { useAuth } from "@/hooks/use-auth";
import Header from "./Header";
import { useApp } from "@/hooks/use-app";
import Dock from "./Dock";
import type { AppData } from "@/lib/types";
import ContextualChatbot from "./ContextualChatbot";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface AppLayoutProps {
    children: React.ReactNode;
    data?: AppData | null;
}

export default function AppLayout({ children, data: dataFromProp }: AppLayoutProps) {
    const { user } = useAuth();
    const { data: dataFromContext } = useApp();
    const pathname = usePathname();
    
    // Use data from props if available (for showcase), otherwise use data from context
    const data = dataFromProp !== undefined ? dataFromProp : dataFromContext;
    
    const tasks = data?.tasks || [];
    const userStats = data?.userStats || { xp: 0 };

    const pageContext = useMemo(() => {
        const baseContext = {
            currentPage: pathname,
            user,
        };

        if (pathname.includes('/tasks')) {
            return { ...baseContext, tasks: data?.tasks };
        }
        if (pathname.includes('/notes')) {
            return { ...baseContext, noteBoards: data?.noteBoards };
        }
        if (pathname.includes('/links')) {
            return { ...baseContext, savedLinks: data?.savedLinks };
        }
        if (pathname.includes('/logs')) {
            return { ...baseContext, logTrackers: data?.logTrackers };
        }
        // For dashboard
        return { ...baseContext, ...data };
    }, [pathname, user, data]);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
             <Header 
                user={user} 
                tasks={tasks} 
                userStats={userStats}
            />
            {/* The dock is fixed at bottom-5 (20px) and is h-16 (64px) tall, so it
                occupies the bottom 84px of the viewport. The previous pb-20 (80px)
                was 4px short, which is why the dock clipped page content on every
                screen. pb-32 leaves a comfortable gutter beneath the last element
                instead of butting right up against the dock. */}
            <div className="flex-1 flex pb-32">
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
            <Dock />
            {user && data && <ContextualChatbot pageContext={pageContext} />}
        </div>
    );
}
