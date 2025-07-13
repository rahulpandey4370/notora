import { cn } from '@/lib/utils';
import type { LucideProps } from 'lucide-react';

export const SparkleIcon = ({ className, ...props }: LucideProps) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('w-4 h-4', className)}
    {...props}
  >
    <path
      d="M12 2L9.88 9.88L2 12L9.88 14.12L12 22L14.12 14.12L22 12L14.12 9.88L12 2Z"
      stroke="hsl(var(--primary))"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SparkleLine = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
        <path
            className="sparkle-line"
            d="M2.5 3.5 L21.5 20.5"
        />
    </svg>
);
