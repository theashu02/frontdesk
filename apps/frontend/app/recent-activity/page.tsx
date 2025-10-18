import { Dashboard } from "@/components/dashboard/dashboard";

export default function RecentActivityPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 justify-center px-4 py-6 sm:px-6 lg:px-10">
        <Dashboard activeView="recent" />
      </div>
    </main>
  );
}
