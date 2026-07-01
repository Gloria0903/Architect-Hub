import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-vellum">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-7 overflow-x-hidden">{children}</main>
    </div>
  );
}
