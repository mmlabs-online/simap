import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function RoomDetailPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.roomDetail.title}
      emptyText={shellCopy.pages.roomDetail.empty}
      icon="meeting_room"
    />
  );
}
