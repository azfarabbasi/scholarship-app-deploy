import { Landmark, PenLine, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { CalendarEventSource } from "@/lib/calendar/events";

const SOURCE_CONFIG: Record<CalendarEventSource, { label: string; icon: typeof Landmark; tone: "blue" | "neutral" }> = {
  official: { label: "Official — verified", icon: Landmark, tone: "blue" },
  personal: { label: "Personal reminder", icon: User, tone: "neutral" },
  custom: { label: "Custom (self-reported)", icon: PenLine, tone: "neutral" },
};

export function EventSourceBadge({ source }: { source: CalendarEventSource }) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;
  return (
    <Badge tone={config.tone} icon={<Icon className="h-full w-full" />}>
      {config.label}
    </Badge>
  );
}
