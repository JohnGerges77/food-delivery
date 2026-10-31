import { AdminShell } from "@/components/features/platform-admin/AdminShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
