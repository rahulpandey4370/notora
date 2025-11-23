
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
    <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50">
      <motion.div
        onMouseMove={(e) => {}}
        onMouseLeave={() => {}}
        className="mx-auto flex h-16 items-end gap-4 rounded-2xl bg-black/10 backdrop-blur-md px-4 pb-3"
      >
        <TooltipProvider>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                    <Link href={getHref(href)}>
                        <div
                            className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-colors
                                ${getIsActive(href) ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground'}`}
                        >
                            <Icon className="h-6 w-6" />
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
    </div>
  );
}
