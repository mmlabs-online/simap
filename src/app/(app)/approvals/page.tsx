import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function ApprovalsPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.approvals.title}
      emptyText={shellCopy.pages.approvals.empty}
      icon="fact_check"
    />
  );
}
