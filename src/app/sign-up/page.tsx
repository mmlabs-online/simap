import type { Metadata } from "next";
import { SignUpPage } from "@/ui";
import { authCopy } from "@/ui/copy/auth";

export const metadata: Metadata = { title: authCopy.signUp.pageTitle, referrer: "no-referrer" };

export default function Page() {
  return <SignUpPage />;
}
