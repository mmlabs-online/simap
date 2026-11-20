import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function DashboardPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.dashboard.title}
      emptyText={shellCopy.pages.dashboard.empty}
      icon="space_dashboard"
    />
  );
}
