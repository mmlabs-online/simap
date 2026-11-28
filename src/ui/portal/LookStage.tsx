import type { AvatarView } from "@/lib/sprites/avatar";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import { FilterChips } from "../Chip";
import { portalCopy } from "../copy/portal";
import type { Atlas } from "../roomlayout/loadAtlas";
import { LookPreview } from "./LookPreview";

const copy = portalCopy.profile.character;

const VIEW_OPTIONS = [
  { value: "front" as const, label: copy.views.front },
  { value: "back" as const, label: copy.views.back },
];

export type LookStageProps = {
  atlas: Atlas | null;
  atlasFailed: boolean;
  look: PixelLook;
  view: AvatarView;
  onViewChange: (view: AvatarView) => void;
};

/** The dotted "A little you" stage: one large figure, a Front/Back toggle and small 1x and 2x previews. Pure view. */
export function LookStage({ atlas, atlasFailed, look, view, onViewChange }: LookStageProps) {
  const preview = (scale: 1 | 2 | 4) => (
    <LookPreview
      atlas={atlas}
      look={look}
      view={view}
      scale={scale}
      label={copy.previewLabel(copy.views[view], scale)}
    />
  );
  return (
    <div className="overflow-hidden rounded-lg border border-divider bg-tile">
      <div
        className="relative flex flex-col gap-3 p-3"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-divider) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
            {copy.stageLabel}
          </span>
          <FilterChips
            ariaLabel={copy.viewToggleLabel}
            options={VIEW_OPTIONS}
            value={view}
            onChange={onViewChange}
          />
        </div>
        {atlasFailed ? (
          <p className="text-caption text-text-secondary">{copy.previewUnavailable}</p>
        ) : (
          <div
            className="flex items-end justify-between gap-3"
            aria-busy={atlas ? undefined : true}
          >
            <div className="flex flex-1 justify-center">{preview(4)}</div>
            <div className="flex flex-col items-center gap-2">
              {preview(1)}
              {preview(2)}
            </div>
          </div>
        )}
      </div>
      <p className="border-t border-divider px-3 py-2 text-center text-caption text-text-secondary">
        {copy.mapsCaption}
      </p>
    </div>
  );
}
