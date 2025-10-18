"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export type DashboardView = "pending" | "recent" | "learned" | "seed";

const VIEW_TITLES: Record<DashboardView, string> = {
  pending: "Pending Help Requests",
  recent: "Recent Activity",
  learned: "Learned Answers",
  seed: "Seed Knowledge",
};

interface DashboardHeaderProps {
  activeView: DashboardView;
  loading: boolean;
  onRefresh: () => void;
  onToggleSidebar: () => void;
}

export function DashboardHeader({
  activeView,
  loading,
  onRefresh,
  onToggleSidebar,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-card/60 px-6 py-4 shadow-sm backdrop-blur lg:pl-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold transition hover:bg-muted lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Supervisor Dashboard
          </p>
          <h1 className="text-lg font-semibold leading-none">
            {VIEW_TITLES[activeView]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
