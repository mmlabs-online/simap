import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function RoomEditorPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.roomEditor.title}
      emptyText={shellCopy.pages.roomEditor.empty}
      icon="edit_square"
    />
  );
}
