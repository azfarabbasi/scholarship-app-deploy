"use client";

import { useMemo } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useWorkspaceRecords } from "@/hooks/useWorkspace";
import { computeCatalogueStats } from "@/lib/catalogue/stats";

const TILES: { key: keyof ReturnType<typeof computeCatalogueStats>; label: string }[] = [
  { key: "total", label: "Total opportunities" },
  { key: "reliableOpenDeadlines", label: "Reliable open deadlines" },
  { key: "approaching", label: "Approaching deadlines" },
  { key: "passedCurrentCycle", label: "Passed this cycle" },
  { key: "rolling", label: "Rolling opportunities" },
  { key: "verificationRequired", label: "Verification required" },
  { key: "shortlisted", label: "Shortlisted by you" },
  { key: "applicationsInProgress", label: "Applications in progress" },
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
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list" aria-label="Catalogue statistics">
      {TILES.map((tile) => (
        <Card key={tile.key} role="listitem">
          <CardBody className="py-4">
            <p className="text-2xl font-semibold text-foreground">{stats[tile.key]}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">{tile.label}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
