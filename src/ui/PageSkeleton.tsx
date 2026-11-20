import type { IconName } from "@/lib/icons";
import { Card } from "./Card";
import { Icon } from "./Icon";

/** Route skeleton: page title plus an empty-state card. Feature tickets replace the card with content. */
export function PageSkeleton({
  title,
  emptyText,
  icon,
}: {
  title: string;
  emptyText: string;
  icon: IconName;
}) {
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <h1 className="text-h2 font-extrabold text-on-surface">{title}</h1>
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Icon name={icon} size={36} className="text-on-surface-variant" />
        <p className="text-sm font-medium text-on-surface-variant">{emptyText}</p>
      </Card>
    </div>
  );
}
