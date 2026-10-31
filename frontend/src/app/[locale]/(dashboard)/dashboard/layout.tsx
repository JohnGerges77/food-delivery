import { DashboardLayoutShell } from "@/components/features/dashboard/DashboardLayoutShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayoutShell>{children}</DashboardLayoutShell>
  );
}
