import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[box-shadow,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Raised from the ground; pressing pushes the control into it.
        default: "bg-primary text-primary-foreground shadow-[var(--neu-raised-sm)] hover:bg-primary/90 active:shadow-[var(--neu-inset)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[var(--neu-raised-sm)] hover:bg-destructive/90 active:shadow-[var(--neu-inset)]",
        // Flat until pressed: raised depth is reserved for primary actions and finished work.
        outline: "border border-input bg-background text-foreground hover:text-primary active:shadow-[var(--neu-inset)]",
        secondary: "border border-border bg-secondary text-foreground hover:text-primary active:shadow-[var(--neu-inset)]",
        ghost: "hover:bg-secondary hover:text-foreground active:shadow-[var(--neu-inset)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
