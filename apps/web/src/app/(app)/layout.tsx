import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
