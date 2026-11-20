import type { ReactNode } from "react";
import { AppShell, AuthGate } from "@/ui";

// Every app page sits behind the sign-in gate; signed-out visitors see the sign-in screen at the same URL.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
