"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { HelpRequest, KnowledgeEntry } from "@/lib/types";

interface FormState {
  answer: string;
  supervisorName: string;
  supervisorNotes: string;
  addToKnowledge: boolean;
  tags: string;
}

const DEFAULT_FORM_STATE: FormState = {
  answer: "",
  supervisorName: "",
  supervisorNotes: "",
  addToKnowledge: true,
  tags: "",
};

export function Dashboard() {
  const [pending, setPending] = useState<HelpRequest[]>([]);
  const [history, setHistory] = useState<HelpRequest[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, FormState>>({});

  const getForm = useCallback(
    (id: string): FormState => formState[id] ?? DEFAULT_FORM_STATE,
    [formState],
  );

  const updateForm = useCallback(
    (id: string, field: keyof FormState, value: string | boolean) => {
      setFormState((prev) => {
        const previous = prev[id] ?? DEFAULT_FORM_STATE;
        return {
          ...prev,
          [id]: {
            ...previous,
            [field]: value,
          },
        };
      });
    },
    [],
  );

  const resetForm = useCallback((id: string) => {
    setFormState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, historyRes, kbRes] = await Promise.all([
        fetch("/api/help-requests?status=pending"),
        fetch("/api/help-requests?status=all"),
        fetch("/api/knowledge-base"),
      ]);

      if (!pendingRes.ok) throw new Error("Failed to load pending help requests");
      if (!historyRes.ok) throw new Error("Failed to load help request history");
      if (!kbRes.ok) throw new Error("Failed to load knowledge base");

      const pendingData = (await pendingRes.json()) as HelpRequest[];
      const historyData = ((await historyRes.json()) as HelpRequest[]).filter(
        (item) => item.status !== "pending",
      );
      const kbData = (await kbRes.json()) as KnowledgeEntry[];

      setPending(pendingData);
      setHistory(historyData);
      setKnowledgeBase(kbData);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleResolve = useCallback(
    async (id: string) => {
      const form = getForm(id);

      if (!form.answer.trim()) {
        setError("Answer is required to resolve a request.");
        return;
      }

      setSubmittingId(id);
      setError(null);

      try {
        const tags = form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

        const res = await fetch(`/api/help-requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: form.answer,
            supervisorName: form.supervisorName,
            supervisorNotes: form.supervisorNotes,
            shouldAddToKnowledgeBase: form.addToKnowledge,
            tags,
          }),
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error ?? "Failed to resolve help request");
        }

        resetForm(id);
        await refresh();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to resolve request");
      } finally {
        setSubmittingId(null);
      }
    },
    [getForm, refresh, resetForm],
  );

  const handleTimeout = useCallback(
    async (id: string) => {
      setSubmittingId(id);
      setError(null);
      try {
        const res = await fetch(`/api/help-requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "timeout" }),
        });

        if (!res.ok) {
          throw new Error("Failed to mark request as timed out");
        }

        resetForm(id);
        await refresh();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to update request");
      } finally {
        setSubmittingId(null);
      }
    },
    [refresh, resetForm],
  );

  const pendingCount = pending.length;
  const resolvedCount = history.filter((item) => item.status === "resolved").length;
  const timeoutCount = history.filter((item) => item.status === "timeout").length;

  const sortedKnowledge = useMemo(
    () =>
      [...knowledgeBase].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [knowledgeBase],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Supervisor Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Triage open requests from the Aurora Glow Salon agent.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <dl className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryCard label="Pending requests" value={pendingCount} />
          <SummaryCard label="Resolved today" value={resolvedCount} />
          <SummaryCard label="Timed out" value={timeoutCount} />
        </dl>
        {error ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pending help requests</h2>
          {pending.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No callers are waiting right now.
            </p>
          ) : (
            pending.map((item) => {
              const form = getForm(item.id);
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <header className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Received {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <h3 className="text-base font-semibold">{item.question}</h3>
                    <p className="text-sm text-muted-foreground">
                      Caller:{" "}
                      {item.customerName
                        ? `${item.customerName} (${item.customerPhone ?? "no number"})`
                        : item.customerPhone ?? "Unknown"}
                    </p>
                  </header>

                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium">
                      Suggested answer
                      <textarea
                        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                        rows={4}
                        value={form.answer}
                        onChange={(event) =>
                          updateForm(item.id, "answer", event.target.value)
                        }
                        placeholder="Type the reply you want the agent to send..."
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Supervisor name
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                        value={form.supervisorName}
                        onChange={(event) =>
                          updateForm(item.id, "supervisorName", event.target.value)
                        }
                        placeholder="Your name (optional)"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Internal notes
                      <textarea
                        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
                        rows={2}
                        value={form.supervisorNotes}
                        onChange={(event) =>
                          updateForm(item.id, "supervisorNotes", event.target.value)
                        }
                        placeholder="Notes only visible to the team"
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.addToKnowledge}
                          onChange={(event) =>
                            updateForm(item.id, "addToKnowledge", event.target.checked)
                          }
                        />
                        Add to knowledge base
                      </label>

                      <input
                        type="text"
                        className="flex-1 rounded-md border border-border bg-background p-2 text-xs"
                        value={form.tags}
                        onChange={(event) =>
                          updateForm(item.id, "tags", event.target.value)
                        }
                        placeholder="Tags (comma separated)"
                      />
                    </div>
                  </div>

                    <footer className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                        onClick={() => void handleResolve(item.id)}
                        disabled={submittingId === item.id}
                      >
                        {submittingId === item.id ? "Saving..." : "Send to caller"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
                        onClick={() => void handleTimeout(item.id)}
                        disabled={submittingId === item.id}
                      >
                        Mark timeout
                      </button>
                    </footer>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent activity</h2>
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
                  <header className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "resolved"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(item.updatedAt).toLocaleString()}
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
                </article>
              ))
            )}
          </div>

          <h2 className="pt-4 text-lg font-semibold">Knowledge base</h2>
          <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
            {sortedKnowledge.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No entries yet.
              </p>
            ) : (
              sortedKnowledge.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
                >
                  <h3 className="font-semibold">{entry.question}</h3>
                  <p className="mt-1 text-muted-foreground">{entry.answer}</p>
                  <footer className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{new Date(entry.updatedAt).toLocaleString()}</span>
                    {entry.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </footer>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
