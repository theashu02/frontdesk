"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { HelpRequest, KnowledgeBaseEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

type TabKey = "pending" | "history" | "knowledge"

interface DashboardProps {
  initialPending: HelpRequest[]
  initialHistory: HelpRequest[]
  initialKnowledgeBase: KnowledgeBaseEntry[]
}

interface ApiResponse<T> {
  data: T
}

export function Dashboard({
  initialPending,
  initialHistory,
  initialKnowledgeBase,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("pending")
  const [pendingRequests, setPendingRequests] = useState(initialPending)
  const [historyRequests, setHistoryRequests] = useState(initialHistory)
  const [knowledgeBase, setKnowledgeBase] = useState(initialKnowledgeBase)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const [pending, history, knowledge] = await Promise.all([
        fetchJson<ApiResponse<HelpRequest[]>>("/api/help-requests?status=pending"),
        fetchJson<ApiResponse<HelpRequest[]>>("/api/help-requests?status=all"),
        fetchJson<ApiResponse<KnowledgeBaseEntry[]>>("/api/knowledge-base"),
      ])

      setPendingRequests(pending.data.filter((request) => request.status === "pending"))
      setHistoryRequests(
        history.data.filter((request) => request.status !== "pending"),
      )
      setKnowledgeBase(knowledge.data)
    } catch (refreshError) {
      console.error(refreshError)
      setError("Failed to refresh data. Please try again.")
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh()
    }, 15_000)
    return () => clearInterval(interval)
  }, [refresh])

  const stats = useMemo(() => {
    const resolvedToday = historyRequests.filter((request) =>
      request.resolvedAt ? isToday(request.resolvedAt) : false,
    )
    return {
      pending: pendingRequests.length,
      resolvedToday: resolvedToday.length,
      knowledgeItems: knowledgeBase.length,
    }
  }, [pendingRequests.length, historyRequests, knowledgeBase.length])

  return (
    <div className="flex flex-1 flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending Requests" value={stats.pending} />
        <StatCard label="Resolved Today" value={stats.resolvedToday} />
        <StatCard label="Knowledge Entries" value={stats.knowledgeItems} />
      </section>

      <div className="flex items-center justify-between gap-3">
        <nav
          aria-label="Dashboard sections"
          className="flex flex-wrap items-center gap-2"
        >
          <TabButton
            isActive={activeTab === "pending"}
            onClick={() => setActiveTab("pending")}
          >
            Pending Requests
          </TabButton>
          <TabButton
            isActive={activeTab === "history"}
            onClick={() => setActiveTab("history")}
          >
            History
          </TabButton>
          <TabButton
            isActive={activeTab === "knowledge"}
            onClick={() => setActiveTab("knowledge")}
          >
            Knowledge Base
          </TabButton>
        </nav>
        <div className="flex items-center gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button variant="outline" onClick={() => void refresh()} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <section className="flex-1 rounded-lg border border-border bg-card p-4 shadow-sm md:p-6">
        {activeTab === "pending" ? (
          <PendingRequestsPanel
            requests={pendingRequests}
            onChange={refresh}
          />
        ) : null}
        {activeTab === "history" ? (
          <HistoryPanel requests={historyRequests} />
        ) : null}
        {activeTab === "knowledge" ? (
          <KnowledgeBasePanel entries={knowledgeBase} onChange={refresh} />
        ) : null}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  )
}

function TabButton({
  isActive,
  children,
  onClick,
}: {
  isActive: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PendingRequestsPanel({
  requests,
  onChange,
}: {
  requests: HelpRequest[]
  onChange: () => Promise<void> | void
}) {
  if (requests.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-base font-medium">No pending requests 🎉</p>
        <p className="max-w-md text-sm text-muted-foreground">
          New calls that need human attention will appear here as soon as the AI
          receptionist asks for help.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {requests.map((request) => (
        <PendingRequestCard key={request.id} request={request} onChange={onChange} />
      ))}
    </div>
  )
}

function PendingRequestCard({
  request,
  onChange,
}: {
  request: HelpRequest
  onChange: () => Promise<void> | void
}) {
  const [answer, setAnswer] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [notes, setNotes] = useState("")
  const [shouldPersist, setShouldPersist] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<KnowledgeBaseEntry[]>([])

  useEffect(() => {
    let isMounted = true
    void (async () => {
      try {
        const result = await fetchJson<ApiResponse<KnowledgeBaseEntry[]>>(
          `/api/knowledge-base?q=${encodeURIComponent(request.question)}&limit=3`,
        )
        if (isMounted) {
          setSuggestions(result.data)
        }
      } catch (suggestionError) {
        console.error("Failed to load suggestions", suggestionError)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [request.question])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)
    setError(null)

    if (!answer.trim()) {
      setError("Please provide an answer before submitting.")
      setIsSubmitting(false)
      return
    }

    try {
      await fetchJson<ApiResponse<HelpRequest>>(`/api/help-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          answer,
          supervisorName: supervisorName || undefined,
          supervisorNotes: notes || undefined,
          shouldAddToKnowledgeBase: shouldPersist,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
      setFeedback("Reply sent to customer and saved to the knowledge base.")
      setAnswer("")
      setNotes("")
      setSupervisorName("")
      setShouldPersist(true)
      await onChange()
    } catch (submitError) {
      console.error(submitError)
      setError("Unable to resolve the request. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTimeout = async () => {
    setIsSubmitting(true)
    setError(null)
    setFeedback(null)
    try {
      await fetchJson<ApiResponse<HelpRequest>>(`/api/help-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "timeout" }),
        headers: {
          "Content-Type": "application/json",
        },
      })
      setFeedback("The request was marked as timed out.")
      await onChange()
    } catch (timeoutError) {
      console.error(timeoutError)
      setError("Unable to mark the request as timed out.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card/80 p-4 shadow-sm transition hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {formatRelativeTime(request.createdAt)} via {request.channel.toUpperCase()}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{request.question}</h3>
          <p className="text-sm text-muted-foreground">
            Caller: {request.customerName ?? "Unknown"} · {request.customerPhone}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/20 dark:text-amber-200">
          Pending
        </span>
      </header>

      {suggestions.length > 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-border/80 bg-muted/40 p-3 text-sm">
          <p className="font-medium">Suggested answers</p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((entry) => (
              <li key={entry.id} className="rounded-md bg-background/70 p-2 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground">{entry.source}</p>
                <p className="font-medium">{entry.question}</p>
                <p className="text-sm text-muted-foreground">{entry.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your reply to the customer..."
          aria-label="Supervisor response"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Supervisor name</label>
            <Input
              value={supervisorName}
              onChange={(event) => setSupervisorName(event.target.value)}
              placeholder="e.g. Alex Rivera"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Internal notes</label>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes for teammates"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shouldPersist}
            onChange={(event) => setShouldPersist(event.target.checked)}
            className="h-4 w-4 rounded border border-border accent-primary"
          />
          Add this answer to the knowledge base
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Send to customer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleTimeout()}
            disabled={isSubmitting}
          >
            Mark as timeout
          </Button>
          {feedback ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </form>
    </article>
  )
}

function HistoryPanel({ requests }: { requests: HelpRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-base font-medium">No history yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Once supervisors resolve or time out a request, you&apos;ll see it here for quick
          reference.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Question</th>
            <th className="px-3 py-2 font-medium">Answer</th>
            <th className="px-3 py-2 font-medium">Supervisor</th>
            <th className="px-3 py-2 font-medium">Resolved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {requests.map((request) => (
            <tr key={request.id} className="align-top">
              <td className="px-3 py-3">
                <StatusBadge status={request.status} />
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{request.question}</p>
                <p className="text-xs text-muted-foreground">
                  {request.customerName ?? "Unknown"} — {request.customerPhone}
                </p>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{request.answer}</td>
              <td className="px-3 py-3 text-muted-foreground">
                {request.supervisorName ?? "—"}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {request.resolvedAt ? formatDateTime(request.resolvedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KnowledgeBasePanel({
  entries,
  onChange,
}: {
  entries: KnowledgeBaseEntry[]
  onChange: () => Promise<void> | void
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [tags, setTags] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)
    setError(null)

    if (!question.trim() || !answer.trim()) {
      setError("Question and answer are required.")
      setIsSubmitting(false)
      return
    }

    const payload = {
      question,
      answer,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    }

    try {
      await fetchJson<ApiResponse<KnowledgeBaseEntry>>("/api/knowledge-base", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      })
      setFeedback("New answer saved to the knowledge base.")
      setQuestion("")
      setAnswer("")
      setTags("")
      await onChange()
    } catch (submitError) {
      console.error(submitError)
      setError("Unable to save the entry.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-lg font-semibold">Add a custom answer</h3>
        <p className="text-sm text-muted-foreground">
          Teach the AI something new. The next time a customer asks a similar question,
          the agent will reply automatically.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Question</label>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What do you charge for keratin treatments?"
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Answer</label>
            <Textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Yes, we offer keratin treatments for $150. Appointments are available Tuesday through Friday."
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <label className="text-sm font-medium">Tags</label>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="pricing, keratin"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save to knowledge base"}
            </Button>
            {feedback ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold">All entries</h3>
        <div className="mt-3 grid gap-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Add an answer above to seed the knowledge base.
            </p>
          ) : null}
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg border border-border bg-background/60 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-base font-semibold">{entry.question}</h4>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {entry.source}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{entry.answer}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Added {formatRelativeTime(entry.createdAt)}
                </span>
                {entry.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: HelpRequest["status"] }) {
  const variant =
    status === "resolved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : status === "timeout"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
        : "bg-muted text-muted-foreground"

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", variant)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const diff = Date.now() - date.getTime()

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) {
    return "just now"
  }
  if (diff < hour) {
    const minutes = Math.floor(diff / minute)
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  }
  const days = Math.floor(diff / day)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isToday(timestamp: string): boolean {
  const date = new Date(timestamp)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}
