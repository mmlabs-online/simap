import type { ReactNode } from "react";
import { AppShell, SessionProvider } from "@/ui";

// Signed out until the auth tickets (SIM-006/SIM-007) provide a real session.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider value={null}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
