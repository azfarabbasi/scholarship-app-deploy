import { forwardRef } from "react";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type HTMLParagraphAttributes = HTMLAttributes<HTMLParagraphElement>;

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-foreground", className)} {...props} />;
}

export function HelpText({ className, ...props }: HTMLParagraphAttributes) {
  return <p className={cn("mt-1 text-xs text-foreground-subtle", className)} {...props} />;
}

export function FieldError({ className, ...props }: HTMLParagraphAttributes) {
  return (
    <p role="alert" className={cn("mt-1 text-xs font-medium text-danger", className)} {...props} />
  );
}

const fieldBaseClasses =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBaseClasses, invalid && "border-danger", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBaseClasses, "min-h-24 resize-y", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(fieldBaseClasses, "pr-8", invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
});

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref,
) {
  return (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 text-sm text-foreground", className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-border text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});

export interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, id, checked, ...props },
  ref,
) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-foreground", className)}>
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-surface-muted transition-colors has-[:checked]:bg-brand">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-4 w-4 translate-x-0.5 rounded-full bg-surface shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span>{label}</span>
    </label>
  );
});
