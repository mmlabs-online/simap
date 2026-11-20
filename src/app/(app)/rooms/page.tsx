import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function RoomsPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.rooms.title}
      emptyText={shellCopy.pages.rooms.empty}
      icon="grid_view"
    />
  );
}
