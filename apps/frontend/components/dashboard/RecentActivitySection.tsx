import type { HelpRequest } from "@/lib/types";

import { formatTimestamp } from "./utils";

interface RecentActivitySectionProps {
  history: HelpRequest[];
}

export function RecentActivitySection({ history }: RecentActivitySectionProps) {
  return (
    <div className="space-y-3">
      {history.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No history yet. Resolved items will appear here.
        </p>
      ) : (
        history.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.status === "resolved"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}
              >
                {item.status.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground">
                Updated {formatTimestamp(item.updatedAt)}
              </span>
            </header>
            <p className="mt-2 font-medium">{item.question}</p>
            {item.answer ? (
              <p className="mt-1 text-muted-foreground">
                <span className="font-semibold">
                  Answer from {item.supervisorName ?? "supervisor"}:
                </span>{" "}
                {item.answer}
              </p>
            ) : null}
            {item.supervisorNotes ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Notes: {item.supervisorNotes}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {item.status === "resolved"
                ? `Responded ${formatTimestamp(item.respondedAt ?? item.resolvedAt)}`
                : `Timed out ${formatTimestamp(item.timedOutAt ?? item.updatedAt)}`}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
