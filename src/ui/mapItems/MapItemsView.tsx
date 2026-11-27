"use client";

import { useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { mapItemsCopy } from "../copy/mapItems";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { FilledInput } from "../FilledInput";
import { Icon } from "../Icon";
import { TabBar } from "../TabBar";
import type { ListState } from "../groups/ListSection";
import type { Atlas } from "../roomlayout/loadAtlas";
import { MapItemCard } from "./MapItemCard";
import { activeGroup, catalogGroups, filterItems, mapItemStats } from "./map-items-state";

export type MapItemsViewProps = {
  access: "ok" | "forbidden";
  items: ListState<MapItemDto>;
  onEdit: (item: MapItemDto) => void;
  /** The blob URL of the card thumbnail (a custom image), or null. */
  thumbUrl?: (item: MapItemDto) => string | null;
  /** The sprite atlas, for the preview of items that have no custom image. */
  atlas?: Atlas | null;
  onRetry: () => void;
};

const { header, stats: statsCopy, tabs, search, grid, footer } = mapItemsCopy;
const ALL = "";
const PANEL_ID = "map-items-panel";
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-caption font-medium uppercase tracking-widest text-text-secondary">
        {header.eyebrow}
      </p>
      <h1 className="text-display text-text-primary">
        {shellCopy.pages.mapItems.title}
        <span aria-hidden="true" className="text-workspace-primary">
          .
        </span>
      </h1>
      <p className="text-label text-text-secondary">{header.subtitle}</p>
    </div>
  );
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <p className="flex items-baseline gap-2">
    <span className="text-subtitle text-text-primary">{n}</span>
    <span className="text-label text-text-secondary">{label}</span>
  </p>
);

/** The stats bar, group tabs, search, card grid and footer. Pure: the selection and query come from props. */
export function MapItemsList({
  items,
  group,
  query,
  onGroup,
  onQuery,
  onEdit,
  thumbUrl,
  atlas,
}: {
  items: readonly MapItemDto[];
  group: string | null;
  query: string;
  onGroup: (group: string | null) => void;
  onQuery: (query: string) => void;
  onEdit: (item: MapItemDto) => void;
  thumbUrl?: (item: MapItemDto) => string | null;
  atlas?: Atlas | null;
}) {
  const groups = catalogGroups(items).map((g) => g.group);
  const active = activeGroup(groups, group);
  const shown = filterItems(items, active, query);
  const stats = mapItemStats(items);
  const ids = [ALL, ...groups];
  const tabId = (id: string) => `map-items-tab-${ids.indexOf(id)}`;
  return (
    <>
      <Card as="section" className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <h2 className="sr-only">{statsCopy.label}</h2>
        <Stat n={stats.total} label={statsCopy.total(stats.total)} />
        <Stat n={stats.inPalette} label={statsCopy.inPalette} />
        <Stat n={stats.customised} label={statsCopy.customised} />
        <p className="flex basis-full items-center gap-2 text-caption text-text-secondary sm:ml-auto sm:basis-auto">
          <Icon name="grid_view" size={16} />
          {statsCopy.note}
        </p>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <TabBar
            variant="pill"
            ariaLabel={tabs.label}
            tabs={[
              { id: ALL, label: tabs.all, count: stats.total },
              ...groups.map((g) => ({ id: g, label: g })),
            ]}
            active={active ?? ALL}
            onSelect={(id) => onGroup(id === ALL ? null : id)}
            tabIdOf={tabId}
            panelIdOf={() => PANEL_ID}
          />
        </div>
        <div role="search" className="w-full shrink-0 sm:w-72">
          <FilledInput
            type="search"
            name="map-items-search"
            autoComplete="off"
            aria-label={search.label}
            placeholder={search.placeholder}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </div>

      <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(active ?? ALL)}>
        <h2 className="sr-only">{grid.heading}</h2>
        {shown.length > 0 ? (
          <ul role="list" className={GRID}>
            {shown.map((item) => (
              <li key={item.builtinKey} className="min-w-0">
                <MapItemCard item={item} thumbUrl={thumbUrl} atlas={atlas} onEdit={onEdit} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="px-6 py-8 text-center">
            <p className="text-label text-text-secondary">{grid.noMatch}</p>
          </Card>
        )}
      </div>

      <p className="text-caption text-text-secondary">
        <span role="status">{footer.showing(shown.length, stats.total)}</span>
        <span aria-hidden="true"> · </span>
        {footer.note}
      </p>
    </>
  );
}

/** The Map items page body. Pure: data and handlers come from props. */
export function MapItemsView({
  access,
  items,
  onEdit,
  thumbUrl,
  atlas,
  onRetry,
}: MapItemsViewProps) {
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const allowed = access !== "forbidden";
  return (
    <div className="page-library flex flex-col gap-6">
      <Header />

      {!allowed && (
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-label text-text-secondary">
            {mapItemsCopy.noAccess}
          </p>
        </Card>
      )}

      {allowed && items.status === "loading" && (
        <div aria-busy="true" className={GRID}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-64 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {allowed && items.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-error">
            {apiErrorMessage(items.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {groupsCopy.retry}
          </Button>
        </Card>
      )}

      {allowed && items.status === "ready" && items.items.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <p className="text-label text-text-secondary">{mapItemsCopy.list.empty}</p>
        </Card>
      )}

      {allowed && items.status === "ready" && items.items.length > 0 && (
        <MapItemsList
          items={items.items}
          group={group}
          query={query}
          onGroup={setGroup}
          onQuery={setQuery}
          onEdit={onEdit}
          thumbUrl={thumbUrl}
          atlas={atlas}
        />
      )}
    </div>
  );
}
