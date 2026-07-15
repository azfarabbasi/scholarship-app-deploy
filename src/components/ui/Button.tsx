import { Children, cloneElement, forwardRef, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders the single child element (e.g. a Next.js Link) with button styling instead of a <button>. */
  asChild?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-foreground hover:opacity-90 border border-transparent",
  secondary: "bg-surface-muted text-foreground hover:bg-border border border-border",
  outline: "bg-transparent text-foreground border border-border hover:bg-surface-muted",
  ghost: "bg-transparent text-foreground border border-transparent hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10 p-0 justify-center",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cn(
    "inline-flex items-center rounded-md font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", asChild, children, ...props },
  ref,
) {
  const classes = buttonClasses(variant, size, className);

  if (asChild) {
    const child = Children.only(children) as ReactElement<{ className?: string }>;
    if (isValidElement(child)) {
      return cloneElement(child, { className: cn(classes, child.props.className) });
    }
  }

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  );
});
