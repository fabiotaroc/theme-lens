"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--accent-strong),var(--accent-deep))] text-primary-foreground shadow-[0_16px_28px_rgba(16,98,95,0.22)] hover:-translate-y-px",
        secondary:
          "border border-[var(--line-strong)] bg-white/80 text-foreground hover:border-[rgba(16,98,95,0.22)] hover:bg-white",
        outline:
          "border border-border bg-background/70 text-foreground hover:bg-accent/10 hover:text-foreground",
        ghost: "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-95",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "size-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
