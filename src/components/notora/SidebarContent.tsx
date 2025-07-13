// src/components/notora/SidebarContent.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckSquare, StickyNote } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/notes', label: 'Notes', icon: StickyNote },
];

interface SidebarContentProps {
  onLinkClick?: () => void;
}

export default function SidebarContent({ onLinkClick }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile view: List */}
      <nav className="md:hidden flex flex-col p-4 space-y-2">
        <Link href="/" className='flex items-center gap-2 mb-4'>
            <img src="https://placehold.co/32x32/FFDA63/000000.png?text=N" alt="Notora Logo" data-ai-hint="logo initial" className="rounded-md" />
            <h1 className="text-xl font-bold font-headline text-foreground">Notora</h1>
        </Link>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors text-lg ${
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <item.icon className="h-5 w-5 mr-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Desktop view: Icons */}
      <div className="hidden md:flex flex-col items-center w-16 space-y-4">
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={`flex items-center justify-center h-10 w-10 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </>
  );
}
