"use client";

import { useState } from "react";
import { TIERS } from "@/lib/tier";
import {
  Avatar,
  Button,
  Card,
  Chip,
  DialogField,
  DialogSelect,
  EntityFormDialog,
  FilledInput,
  FilterChips,
  IconButton,
  Pill,
  RoleBadge,
  SegmentedFilter,
} from "@/ui";
import { galleryCopy as c } from "@/ui/copy/gallery";
import { kitCopy } from "@/ui/copy/kit";

/** Every kit component on one page, for the manual light/dark check. Dev-only. */
export function KitGallery() {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("list");
  const filters = [
    { value: "all", label: c.filters.all },
    { value: "free", label: c.filters.free, icon: "grid_view" as const },
    { value: "used", label: c.filters.used, icon: "person" as const },
  ];

  return (
    <div className="page-content flex flex-col gap-4">
      <h1 className="text-display font-semibold">{c.title}</h1>

      <Card className="p-5 flex flex-wrap items-center gap-3">
        <Button>{c.buttons.primary}</Button>
        <Button variant="tonal">{c.buttons.tonal}</Button>
        <Button variant="outlined" icon="add">
          {c.buttons.outlined}
        </Button>
        <Button variant="pixel">{c.buttons.pixel}</Button>
        <Button variant="text">{c.buttons.text}</Button>
        <Button variant="danger">{c.buttons.danger}</Button>
        <Button disabled>{c.buttons.disabled}</Button>
        <IconButton icon="search" label={c.buttons.search} />
        <IconButton icon="mail" label={c.buttons.mail} active />
      </Card>

      <Card className="p-5 flex flex-wrap items-center gap-3">
        <FilterChips
          options={filters}
          value={filter}
          onChange={setFilter}
          ariaLabel={c.filters.ariaLabel}
        />
        <Chip label={c.chip} icon="group" />
        <Avatar name="Nguyễn Văn An" />
        <Avatar name="Lê Thị Bình" color="var(--color-workspace-primary)" />
        {TIERS.map((t) => (
          <RoleBadge key={t} tier={t} />
        ))}
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill label={c.pills.accent} tone="accent" />
          <Pill label={c.pills.neutral} tone="neutral" />
          <Pill label={c.pills.success} tone="success" />
          <Pill label={c.pills.warning} tone="warning" />
          <Pill label={c.pills.danger} tone="danger" />
          <Pill label={c.pills.info} tone="info" />
        </div>
        <label className="flex min-h-control items-center gap-2 text-label">
          <input type="checkbox" defaultChecked />
          {c.checkbox}
        </label>
        <SegmentedFilter
          ariaLabel={c.segments.ariaLabel}
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: c.segments.list },
            { value: "grid", label: c.segments.grid },
          ]}
        />
        <FilledInput aria-label={c.input.ariaLabel} placeholder={c.input.placeholder} />
        <div>
          <Button onClick={() => setOpen(true)}>{c.dialog.open}</Button>
        </div>
      </Card>

      <EntityFormDialog
        open={open}
        title={c.dialog.title}
        subtitle={c.dialog.subtitle}
        submitLabel={kitCopy.save}
        onClose={() => setOpen(false)}
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <DialogField
          label={c.dialog.code}
          icon="meeting_room"
          placeholder="A1" // copy-ok: sample room code is data
        />
        <DialogSelect label={c.dialog.type} icon="group">
          <option>{c.dialog.meeting}</option>
          <option>{c.dialog.work}</option>
        </DialogSelect>
      </EntityFormDialog>
    </div>
  );
}
