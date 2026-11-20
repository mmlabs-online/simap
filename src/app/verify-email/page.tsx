import type { Metadata } from "next";
import { VerifyEmailPage } from "@/ui";
import { authCopy } from "@/ui/copy/auth";

export const metadata: Metadata = { title: authCopy.verify.pageTitle, referrer: "no-referrer" };

export default function Page() {
  return <VerifyEmailPage />;
}
