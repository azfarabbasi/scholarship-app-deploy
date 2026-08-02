"use client";

import {
  AlertTriangle,
  BookmarkCheck,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  Library,
  Loader,
  Repeat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useWorkspaceRecords } from "@/hooks/useWorkspace";
import { computeCatalogueStats } from "@/lib/catalogue/stats";

type StatKey = keyof ReturnType<typeof computeCatalogueStats>;

/**
 * `chip` colours the icon and `bar` the accent stripe along the tile's top
 * edge — never the value or the label. Several of these tints are documented
 * in globals.css as icon/background-safe but not AA for text, and keeping the
 * number in `foreground` means the tile reads identically to someone who can't
 * separate the hues. Colour here is a second channel, never the only one.
 */
const TILES: { key: StatKey; label: string; icon: LucideIcon; chip: string; bar: string }[] = [
  { key: "total", label: "Total", icon: Library, chip: "bg-brand-tint text-brand", bar: "bg-brand" },
  { key: "reliableOpenDeadlines", label: "Open now", icon: CircleCheck, chip: "bg-success-tint text-success", bar: "bg-success" },
  { key: "approaching", label: "Due soon", icon: CalendarClock, chip: "bg-warning-tint text-warning", bar: "bg-warning" },
  { key: "passedCurrentCycle", label: "Passed", icon: CalendarX2, chip: "bg-neutral-tint text-foreground-muted", bar: "bg-border" },
  { key: "rolling", label: "Rolling", icon: Repeat, chip: "bg-info-tint text-info", bar: "bg-info" },
  { key: "verificationRequired", label: "Verify", icon: AlertTriangle, chip: "bg-danger-tint text-danger", bar: "bg-danger" },
  { key: "shortlisted", label: "Shortlisted", icon: BookmarkCheck, chip: "bg-brand-tint text-brand", bar: "bg-brand" },
  { key: "applicationsInProgress", label: "In progress", icon: Loader, chip: "bg-mint-tint text-mint", bar: "bg-mint" },
];

export function StatsGrid() {
  const { items, now, loading } = useCatalogue();
  const { records: workspaceRecords } = useWorkspaceRecords();

  const stats = useMemo(() => {
    if (!now) return null;
    return computeCatalogueStats(
      items.map((item) => item.opportunity),
      workspaceRecords,
      now,
    );
  }, [items, workspaceRecords, now]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4" role="list" aria-label="Catalogue statistics">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card
            key={tile.key}
            role="listitem"
            className="group relative overflow-hidden transition-colors duration-300 hover:border-brand/40"
          >
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${tile.bar}`} />
            <CardBody className="flex items-center gap-3 py-4 pt-5">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100 ${tile.chip}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-3xl font-semibold leading-none tracking-tight text-foreground">
                  {stats[tile.key]}
                </span>
                <span className="mt-1.5 block text-xs leading-snug text-foreground-muted">{tile.label}</span>
              </span>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
