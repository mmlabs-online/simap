import type { Metadata } from "next";
import { ResetPasswordPage } from "@/ui";
import { authCopy } from "@/ui/copy/auth";

export const metadata: Metadata = { title: authCopy.reset.pageTitle, referrer: "no-referrer" };

export default function Page() {
  return <ResetPasswordPage />;
}
