import type { DeviceTypeDto } from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { DeviceTypeThumb } from "./DeviceTypeThumb";
import { ListSection, type ListState } from "../groups/ListSection";

/** The list thumbnail sits beside the name, so its alt text is empty. */
const DECORATIVE = "";

export type DeviceTypesViewProps = {
  access: "ok" | "forbidden";
  types: ListState<DeviceTypeDto>;
  onNew: () => void;
  onEdit: (type: DeviceTypeDto) => void;
  onDelete: (type: DeviceTypeDto) => void;
  onRetry: () => void;
  imageUrl: (type: DeviceTypeDto) => string | null;
};

/** The Device types page body. Pure: data and handlers come from props. */
export function DeviceTypesView(props: DeviceTypesViewProps) {
  const title = (
    <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.deviceTypes.title}</h1>
  );
  if (props.access === "forbidden") {
    return (
      <div className="page-library flex flex-col gap-4">
        {title}
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-sm font-medium text-on-surface-variant">
            {deviceTypesCopy.noAccess}
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="page-library flex flex-col gap-6">
      {title}
      <ListSection
        title={deviceTypesCopy.list.title}
        newLabel={deviceTypesCopy.list.new}
        emptyText={deviceTypesCopy.list.empty}
        list={props.types}
        rowKey={(t) => t.id}
        onNew={props.onNew}
        onRetry={props.onRetry}
        renderRow={(t) => (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <DeviceTypeThumb url={props.imageUrl(t)} alt={DECORATIVE} />
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="truncate text-sm font-bold text-on-surface">{t.name}</span>
                <span className="shrink-0 text-sm font-medium text-on-surface-variant">
                  {deviceTypesCopy.slots[t.slot].label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="tonal"
                size="sm"
                icon="edit"
                aria-label={deviceTypesCopy.editLabel(t.name)}
                onClick={() => props.onEdit(t)}
              >
                {deviceTypesCopy.edit}
              </Button>
              <Button
                variant="danger"
                size="sm"
                aria-label={deviceTypesCopy.deleteLabel(t.name)}
                onClick={() => props.onDelete(t)}
              >
                {deviceTypesCopy.delete}
              </Button>
            </div>
          </>
        )}
      />
    </div>
  );
}
