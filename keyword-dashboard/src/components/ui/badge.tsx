import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950",
  {
    variants: {
      variant: {
        default: "border-zinc-700 bg-zinc-800 text-zinc-300",
        informational: "border-blue-500/50 bg-blue-500/20 text-blue-300",
        commercial: "border-amber-500/50 bg-amber-500/20 text-amber-300",
        transactional: "border-emerald-500/50 bg-emerald-500/20 text-emerald-300",
        outline: "border-zinc-700 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
