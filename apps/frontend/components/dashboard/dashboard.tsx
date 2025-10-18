"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { HelpRequest, KnowledgeEntry } from "@/lib/types";

import { DashboardHeader, type DashboardView } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { KnowledgePanel } from "./KnowledgePanel";
import { PendingRequestsSection } from "./PendingRequestsSection";
import { RecentActivitySection } from "./RecentActivitySection";
import { DEFAULT_FORM_STATE, type FormState } from "./types";

interface DashboardProps {
  activeView?: DashboardView;
}

export function Dashboard({ activeView = "pending" }: DashboardProps) {
  const [pending, setPending] = useState<HelpRequest[]>([]);
  const [history, setHistory] = useState<HelpRequest[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, FormState>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
      }
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
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh({ silent: true });
    }, 5000);

    return () => window.clearInterval(interval);
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

  const isSameDay = (value?: string) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const pendingCount = pending.length;
  const resolvedTodayCount = history.filter(
    (item) =>
      item.status === "resolved" &&
      isSameDay(item.respondedAt ?? item.resolvedAt ?? item.updatedAt),
  ).length;
  const timeoutCount = history.filter((item) => item.status === "timeout").length;

  const sortedKnowledge = useMemo(
    () =>
      [...knowledgeBase].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [knowledgeBase],
  );

  const learnedEntries = useMemo(
    () => sortedKnowledge.filter((entry) => entry.source && entry.source !== "seed"),
    [sortedKnowledge],
  );

  const seedEntries = useMemo(
    () => sortedKnowledge.filter((entry) => !entry.source || entry.source === "seed"),
    [sortedKnowledge],
  );

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex w-full max-w-screen flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-lg">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingCount={pendingCount}
        resolvedCount={resolvedTodayCount}
        timeoutCount={timeoutCount}
        activeView={activeView}
      />

      <div className="flex flex-1 flex-col">
        <DashboardHeader
          activeView={activeView}
          loading={loading}
          onRefresh={handleRefresh}
          onToggleSidebar={handleSidebarToggle}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {activeView === "pending" ? (
              <section className="space-y-4">
                <header>
                  <h2 className="text-xl font-semibold">Pending help requests</h2>
                  <p className="text-sm text-muted-foreground">
                    Review suggested answers and respond before the caller leaves the queue.
                  </p>
                </header>
                <PendingRequestsSection
                  requests={pending}
                  getForm={getForm}
                  updateForm={updateForm}
                  onResolve={handleResolve}
                  onTimeout={handleTimeout}
                  submittingId={submittingId}
                />
              </section>
            ) : null}

            {activeView === "recent" ? (
              <section className="space-y-4">
                <header>
                  {/* <h2 className="text-xl font-semibold">Recent activity</h2> */}
                  <p className="text-sm text-muted-foreground">
                    Track how the supervisor team has handled recent calls and escalations.
                  </p>
                </header>
                <RecentActivitySection history={history} />
              </section>
            ) : null}

            {activeView === "learned" ? (
              <section className="space-y-4">
                <header>
                  <p className="text-sm text-muted-foreground">
                    Supervisor-approved responses saved to the knowledge base appear here.
                  </p>
                </header>
                <KnowledgePanel
                  entries={learnedEntries}
                  emptyLabel="No learned answers yet. Supervisor-approved replies will show up here."
                />
              </section>
            ) : null}

            {activeView === "seed" ? (
              <section className="space-y-4">
                <header>
                  {/* <h2 className="text-xl font-semibold">Seed knowledge</h2> */}
                  <p className="text-sm text-muted-foreground">
                    The foundational answers provided to the agent before learning from calls.
                  </p>
                </header>
                <KnowledgePanel entries={seedEntries} emptyLabel="No seed entries found." />
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

