import type { IconName } from "@/lib/icons";
import { Card } from "../Card";
import { Icon } from "../Icon";

/** One dashboard number: icon, label and value. */
export function StatTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon name={icon} />
        <span className="text-label">{label}</span>
      </div>
      <p className="text-title text-text-primary">{value}</p>
    </Card>
  );
}
