"use client";

import { useRouter } from "next/navigation";
import { AuthGate } from "./AuthGate";
import { CheckingView } from "./views";

/** The `/sign-in` page body: its own gate; once signed in, goes to the validated return path. */
export function SignInRoute({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  return (
    <AuthGate onReady={() => router.replace(returnTo)}>
      <CheckingView />
    </AuthGate>
  );
}
