"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import type { DashboardView } from "./DashboardHeader";

interface DashboardSidebarProps {
  open: boolean;
  onClose: () => void;
  pendingCount: number;
  resolvedCount: number;
  timeoutCount: number;
  activeView: DashboardView;
}

type SidebarTone = "primary" | "success" | "warning";

const NAV_ITEMS: Array<{ label: string; href: string; view: DashboardView }> = [
  { label: "Pending Requests", href: "/", view: "pending" },
  { label: "Recent Activity", href: "/recent-activity", view: "recent" },
  { label: "Learned Answers", href: "/learned-answers", view: "learned" },
  { label: "Seed Knowledge", href: "/seed-knowledge", view: "seed" },
];

export function DashboardSidebar({
  open,
  onClose,
  pendingCount,
  resolvedCount,
  timeoutCount,
  activeView,
}: DashboardSidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <Link
            href="/"
            onClick={onClose}
            className="text-sm font-semibold uppercase tracking-wide text-foreground transition hover:text-primary"
          >
            Radiance Glow Salon
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs font-semibold transition hover:bg-muted lg:hidden"
            aria-label="Close sidebar"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5">
          <nav className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </p>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted",
                  activeView === item.view
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
                {activeView === item.view ? (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Active
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="space-y-3">
            <SidebarStat label="Pending Requests" value={pendingCount} tone="primary" />
            <SidebarStat label="Resolved Today" value={resolvedCount} tone="success" />
            <SidebarStat label="Timed Out" value={timeoutCount} tone="warning" />
          </div>
        </div>

        <div className="border-t border-border/60 px-6 py-4 text-xs text-muted-foreground">
          Powered by Frontdesk Supervisor
        </div>
      </aside>
    </>
  );
}

function SidebarStat({ label, value, tone }: { label: string; value: number; tone: SidebarTone }) {
  const toneClasses: Record<SidebarTone, string> = {
    primary: "text-primary",
    success: "text-emerald-600",
    warning: "text-amber-600",
  };

  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-3 text-3xl font-semibold", toneClasses[tone])}>
        {value}
      </p>
    </div>
  );
}
