'use client';

import { motion, useMotionValue } from 'framer-motion';
import { Home, CheckSquare, StickyNote, Link2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  { href: '/links', label: 'Links', icon: Link2 },
];

export default function Dock() {
  const mouseX = useMotionValue(Infinity);
  const pathname = usePathname();

  return (
    <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.nativeEvent.x)}
        onMouseLeave={() => mouseX.set(Infinity)}
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
                    <Link href={href}>
                        <div
                            className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-colors
                                ${pathname === href ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground'}`}
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
