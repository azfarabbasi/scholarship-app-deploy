import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/Card";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
        {icon ? (
          <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-subtle">
            {icon}
          </div>
        ) : null}
        <div>
          <p className="text-base font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        </div>
        {action}
      </CardBody>
    </Card>
  );
}
