import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/ui";
import { authCopy } from "@/ui/copy/auth";

export const metadata: Metadata = { title: authCopy.forgot.pageTitle, referrer: "no-referrer" };

export default function Page() {
  return <ForgotPasswordPage />;
}
