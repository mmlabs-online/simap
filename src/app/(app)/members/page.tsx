import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function MembersPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.members.title}
      emptyText={shellCopy.pages.members.empty}
      icon="group"
    />
  );
}
