'use client';

/**
 * Progressive disclosure for technical / explanatory copy (DOGEX.store-style).
 * Keeps primary UI minimal; expands for auditors and power users.
 */
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TechDetails({
  summary = 'Geek details',
  className,
  summaryClassName,
  contentClassName,
  children,
}: {
  summary?: string;
  className?: string;
  /** e.g. text-white/55 for dark wallet panels */
  summaryClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn('group text-xs text-muted-foreground', className)}>
      <summary
        className={cn(
          'cursor-pointer select-none list-none hover:text-foreground [&::-webkit-details-marker]:hidden',
          summaryClassName,
        )}
      >
        <span className="underline decoration-dotted underline-offset-2">{summary}</span>
        <span className="ml-0.5 opacity-60 group-open:hidden">▸</span>
        <span className="ml-0.5 opacity-60 hidden group-open:inline">▾</span>
      </summary>
      <div className={cn('mt-1.5 space-y-1.5 border-l border-border pl-2.5 leading-relaxed', contentClassName)}>
        {children}
      </div>
    </details>
  );
}
