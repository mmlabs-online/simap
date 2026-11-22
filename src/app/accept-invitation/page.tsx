import type { Metadata } from "next";
import { AcceptInvitationPage } from "@/ui";
import { invitationsCopy } from "@/ui/copy/invitations";

export const metadata: Metadata = {
  title: invitationsCopy.accept.pageTitle,
  referrer: "no-referrer",
};

export default function Page() {
  return <AcceptInvitationPage />;
}
