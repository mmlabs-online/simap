import type { Zoom } from "@/lib/sprites/layout";
import type { SaveBlock } from "@/lib/layout-editor/editor-state";
import { Button } from "../Button";
import { roomlayoutCopy } from "../copy/roomlayout";
import { ZoomControl } from "./ZoomControl";

const copy = roomlayoutCopy.editor;

type Props = {
  dirty: boolean;
  canUndo: boolean;
  canSave: boolean;
  saving: boolean;
  saveBlock: SaveBlock;
  zoom: Zoom;
  onBack: () => void;
  onUndo: () => void;
  onSave: () => void;
  onZoom: (zoom: Zoom) => void;
};

/** Back, Undo, zoom, the unsaved indicator and Save with the reason when Save is blocked. */
export function EditorToolbar(p: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" size="sm" onClick={p.onBack}>
          {copy.backToRoom}
        </Button>
        <Button
          variant="tonal"
          size="sm"
          disabled={!p.canUndo}
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={p.onUndo}
        >
          {copy.undo}
        </Button>
        <ZoomControl zoom={p.zoom} onZoom={p.onZoom} />
        <span className="flex-1" />
        {p.dirty && (
          <span className="text-label font-semibold text-text-primary">{copy.unsaved}</span>
        )}
        <Button
          size="sm"
          disabled={!p.canSave}
          aria-busy={p.saving}
          aria-keyshortcuts="Control+S Meta+S"
          aria-describedby={p.saveBlock ? "editor-save-reason" : undefined}
          onClick={p.onSave}
        >
          {p.saving ? copy.saving : copy.save}
        </Button>
      </div>
      {p.saveBlock && (
        <p id="editor-save-reason" className="text-label font-normal text-text-secondary">
          {copy.saveBlock[p.saveBlock]}
        </p>
      )}
    </div>
  );
}
