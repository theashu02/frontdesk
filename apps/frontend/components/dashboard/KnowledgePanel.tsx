import type { KnowledgeEntry } from "@/lib/types";

import { cn } from "@/lib/utils";

import { formatTimestamp } from "./utils";

interface KnowledgePanelProps {
  entries: KnowledgeEntry[];
  emptyLabel: string;
  className?: string;
}

export function KnowledgePanel({ entries, emptyLabel, className }: KnowledgePanelProps) {
  return (
    <div className={cn("min-h-0 space-y-3 overflow-y-auto pr-1 custom-scrollbar", className)}>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
          >
            <h3 className="font-semibold">{entry.question}</h3>
            <p className="mt-1 text-muted-foreground">{entry.answer}</p>
            <footer className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{formatTimestamp(entry.updatedAt)}</span>
              {entry.source ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {entry.source}
                </span>
              ) : null}
              {entry.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  #{tag}
                </span>
              ))}
            </footer>
          </article>
        ))
      )}
    </div>
  );
}
