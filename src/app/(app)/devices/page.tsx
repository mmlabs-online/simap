import { PageSkeleton } from "@/ui";
import { shellCopy } from "@/ui/copy/shell";

export default function DevicesPage() {
  return (
    <PageSkeleton
      title={shellCopy.pages.devices.title}
      emptyText={shellCopy.pages.devices.empty}
      icon="lan"
    />
  );
}
