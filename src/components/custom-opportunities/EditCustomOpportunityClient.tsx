"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { useBuiltInOpportunities } from "@/hooks/useBuiltInOpportunities";
import {
  deleteCustomOpportunity,
  getCustomOpportunityById,
  updateCustomOpportunity,
} from "@/lib/storage/custom-opportunities";
import { deleteWorkspaceRecord } from "@/lib/storage/workspace";
import type { CustomOpportunityRecord } from "@/lib/storage/types";
import { CustomOpportunityForm } from "./CustomOpportunityForm";

export function EditCustomOpportunityClient({ id }: { id: string }) {
  const [record, setRecord] = useState<CustomOpportunityRecord | null | undefined>(undefined);
  const router = useRouter();
  const { announce } = useLiveAnnouncer();
  const { items: builtInOpportunities } = useBuiltInOpportunities();

  useEffect(() => {
    let cancelled = false;
    getCustomOpportunityById(id).then((result) => {
      if (!cancelled) setRecord(result ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (record === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (record === null) {
    return (
      <EmptyState
        title="Custom opportunity not found"
        description="It may have already been deleted, or it isn't saved on this device or browser."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <CustomOpportunityForm
        initialRecord={record}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          const updated = await updateCustomOpportunity(
            id,
            input,
            builtInOpportunities.map((o) => o.slug),
          );
          return { slug: updated.slug };
        }}
      />

      <div className="border-t border-border pt-6">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete this custom opportunity
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Delete custom opportunity?"
            description={`"${record.title}" and any tracking data for it (shortlist, notes, checklist, personal deadline) will be permanently removed from this device.`}
          >
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await deleteCustomOpportunity(id);
                    await deleteWorkspaceRecord(`custom-${id}`);
                    announce(`${record.title} deleted.`);
                    router.push("/workspace");
                  }}
                >
                  Delete
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
