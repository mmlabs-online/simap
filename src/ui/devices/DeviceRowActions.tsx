import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { rowActions, type DeviceRowHandlers } from "./device-actions";

/** The action buttons of one device row or card. Renders nothing when the row has no action. */
export function DeviceRowActions({
  device,
  handlers,
}: {
  device: DeviceDto;
  handlers: DeviceRowHandlers;
}) {
  const actions = rowActions(device, handlers);
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button key={a.key} variant="tonal" size="sm" aria-label={a.ariaLabel} onClick={a.run}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}
