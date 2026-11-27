
'use client';

import { motion } from 'framer-motion';
import { Home, CheckSquare, StickyNote, Link2, ListChecks, BookHeart } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/links', label: 'Links', icon: Link2 },
  { href: '/logs', label: 'Logs', icon: ListChecks },
  { href: '/journal', label: 'Journal', icon: BookHeart },
];

export default function Dock() {
  const pathname = usePathname();
  const isShowcase = pathname.startsWith('/showcase');

  const getHref = (href: string) => {
    if (href === '/dashboard' && isShowcase) return '/showcase/dashboard';
    if (href === '/dashboard' && !isShowcase) return '/';
    return isShowcase ? `/showcase${href}` : href;
  };

  const getIsActive = (href: string) => {
    if (href === '/dashboard') {
        return pathname === '/' || pathname === '/showcase/dashboard';
    }
    return pathname.startsWith(getHref(href));
  }

  return (
    <nav aria-label="Main" className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-2">
      {/* 6 × 44px + gaps fits a 375px phone; full size from sm up. */}
      <motion.div className="mx-auto flex h-16 items-end gap-2 rounded-2xl bg-black/10 px-3 pb-3 backdrop-blur-md sm:gap-4 sm:px-4">
        <TooltipProvider>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                    <Link href={getHref(href)} aria-label={label} aria-current={getIsActive(href) ? 'page' : undefined}>
                        <div
                            className={`flex h-11 w-11 flex-col items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12
                                ${getIsActive(href) ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground'}`}
                        >
                            <Icon className="h-6 w-6" aria-hidden />
                        </div>
                    </Link>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </motion.div>
    </nav>
  );
}
