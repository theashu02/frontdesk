import type { HelpRequest } from "@/lib/types";

import type { FormState } from "./types";

interface PendingRequestCardProps {
  request: HelpRequest;
  form: FormState;
  onFieldChange: (field: keyof FormState, value: string | boolean) => void;
  onResolve: () => void;
  onTimeout: () => void;
  submitting: boolean;
}

export function PendingRequestCard({
  request,
  form,
  onFieldChange,
  onResolve,
  onTimeout,
  submitting,
}: PendingRequestCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          Received {new Date(request.createdAt).toLocaleString()}
        </p>
        <h3 className="text-base font-semibold">{request.question}</h3>
        <p className="text-sm text-muted-foreground">
          Caller:{" "}
          {request.customerName
            ? `${request.customerName} (${request.customerPhone ?? "no number"})`
            : request.customerPhone ?? "Unknown"}
        </p>
      </header>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium">
          Suggested answer
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            rows={4}
            value={form.answer}
            onChange={(event) => onFieldChange("answer", event.target.value)}
            placeholder="Type the reply you want the agent to send..."
          />
        </label>

        <label className="block text-sm font-medium">
          Supervisor name
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            value={form.supervisorName}
            onChange={(event) => onFieldChange("supervisorName", event.target.value)}
            placeholder="Your name (optional)"
          />
        </label>

        <label className="block text-sm font-medium">
          Internal notes
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            rows={2}
            value={form.supervisorNotes}
            onChange={(event) => onFieldChange("supervisorNotes", event.target.value)}
            placeholder="Notes only visible to the team"
          />
        </label>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.addToKnowledge}
              onChange={(event) => onFieldChange("addToKnowledge", event.target.checked)}
            />
            Add to knowledge base
          </label>

          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-background p-2 text-xs"
            value={form.tags}
            onChange={(event) => onFieldChange("tags", event.target.value)}
            placeholder="Tags (comma separated)"
          />
        </div>
      </div>

      <footer className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          onClick={onResolve}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Send to caller"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
          onClick={onTimeout}
          disabled={submitting}
        >
          Mark timeout
        </button>
      </footer>
    </article>
  );
}
