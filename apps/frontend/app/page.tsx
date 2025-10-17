import { Dashboard } from "@/components/dashboard/dashboard"
import { ThemeToggle } from "@/components/theme-toggle"
import { listHelpRequests, listKnowledgeBase } from "@/lib/store"

export default async function Home() {
  const [requests, knowledgeBase] = await Promise.all([
    listHelpRequests({ status: "all" }),
    listKnowledgeBase(),
  ])

  const pending = requests.filter((request) => request.status === "pending")
  const history = requests.filter((request) => request.status !== "pending")

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Front Desk Control Center
          </p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            Human-in-the-loop AI receptionist
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review AI escalations, respond to customers, and grow the salon&apos;s
            knowledge base without leaving this page.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Dashboard
        initialPending={pending}
        initialHistory={history}
        initialKnowledgeBase={knowledgeBase}
      />
    </main>
  )
}
