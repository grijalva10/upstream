import { DataSidebar } from "./_components/data-sidebar";

export default function DataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full overflow-hidden">
      <DataSidebar />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
