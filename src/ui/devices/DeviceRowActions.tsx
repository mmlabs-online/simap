import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { rowActions, type DeviceRowHandlers } from "./device-actions";

/** The action buttons of one device row or card. Renders nothing when the row has no action. */
export function DeviceRowActions({
  device,
  handlers,
  busyId,
}: {
  device: DeviceDto;
  handlers: DeviceRowHandlers;
  busyId?: string | null;
}) {
  const actions = rowActions(device, handlers, busyId);
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.key}
          variant={a.danger ? "danger" : "tonal"}
          size="sm"
          aria-label={a.ariaLabel}
          disabled={a.disabled}
          onClick={a.run}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
