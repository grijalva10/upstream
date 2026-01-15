import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
