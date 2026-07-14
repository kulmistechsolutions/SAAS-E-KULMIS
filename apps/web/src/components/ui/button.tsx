import {
  ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Render the single child element (e.g. a Link) with the button styles. */
  asChild?: boolean;
}

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-input bg-background hover:bg-secondary",
  ghost: "hover:bg-secondary",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const baseClasses =
  "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(baseClasses, variants[variant], className);

    // Minimal Slot: when asChild, style the single child (e.g. a <Link>) instead
    // of rendering a <button>. Avoids nested interactive elements.
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string }>;
      return cloneElement(child, {
        className: cn(classes, child.props.className),
        ...props,
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
