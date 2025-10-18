import type { HelpRequest } from "@/lib/types";

import type { FormState } from "./types";
import { PendingRequestCard } from "./PendingRequestCard";

interface PendingRequestsSectionProps {
  requests: HelpRequest[];
  getForm: (id: string) => FormState;
  updateForm: (id: string, field: keyof FormState, value: string | boolean) => void;
  onResolve: (id: string) => void;
  onTimeout: (id: string) => void;
  submittingId: string | null;
}

export function PendingRequestsSection({
  requests,
  getForm,
  updateForm,
  onResolve,
  onTimeout,
  submittingId,
}: PendingRequestsSectionProps) {
  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No callers are waiting right now.
        </p>
      ) : (
        requests.map((request) => (
          <PendingRequestCard
            key={request.id}
            request={request}
            form={getForm(request.id)}
            onFieldChange={(field, value) => updateForm(request.id, field, value)}
            onResolve={() => onResolve(request.id)}
            onTimeout={() => onTimeout(request.id)}
            submitting={submittingId === request.id}
          />
        ))
      )}
    </div>
  );
}
