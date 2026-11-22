import { InvitePeople, PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function MembersPage() {
  return (
    <>
      <div className="px-4 pt-4 lg:px-6 lg:pt-6 flex justify-end">
        <InvitePeople />
      </div>
      <PageSkeleton
        title={shellCopy.pages.members.title}
        emptyText={shellCopy.pages.members.empty}
        icon="group"
      />
    </>
  );
}
