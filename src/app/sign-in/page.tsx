import type { Metadata } from "next";
import { safeReturnTo } from "@/lib/identity/return-to";
import { SignInRoute } from "@/ui";
import { authCopy } from "@/ui/copy/auth";

export const metadata: Metadata = { title: authCopy.pageTitle };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  return <SignInRoute returnTo={safeReturnTo(returnTo)} />;
}
