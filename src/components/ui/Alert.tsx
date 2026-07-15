import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<AlertTone, string> = {
  info: "bg-info-tint border-info/30 text-info",
  success: "bg-success-tint border-success/30 text-success",
  warning: "bg-warning-tint border-warning/30 text-warning",
  danger: "bg-danger-tint border-danger/30 text-danger",
};

const TONE_ICON: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
}

export function Alert({ tone = "info", title, className, children, role, ...props }: AlertProps) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={role ?? (tone === "danger" || tone === "warning" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", TONE_CLASSES[tone], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="text-foreground">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5 text-foreground-muted")}>{children}</div>
      </div>
    </div>
  );
}
