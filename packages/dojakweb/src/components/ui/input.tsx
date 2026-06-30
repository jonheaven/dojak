import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[var(--ds-border-strong,rgba(255,255,255,0.14))] bg-[var(--ds-panel,#1a1a1a)] px-3 py-2 text-base text-[var(--ds-text,#f0ece0)] ring-offset-[var(--ds-bg,#090909)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--ds-text-muted,rgba(190,185,170,0.72))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent-ring,rgba(232,212,139,0.22))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
