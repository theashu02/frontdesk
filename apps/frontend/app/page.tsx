import { Dashboard } from "@/components/dashboard/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Radiance Salon
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Front Desk Supervisor Console
          </h1>
        </div>
        <ThemeToggle />
      </header>
      <Dashboard />
    </main>
  );
}
