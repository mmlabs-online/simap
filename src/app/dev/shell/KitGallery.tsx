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
  RoleBadge,
} from "@/ui";
import { galleryCopy as c } from "@/ui/copy/gallery";
import { kitCopy } from "@/ui/copy/kit";

/** Every kit component on one page, for the manual light/dark check. Dev-only. */
export function KitGallery() {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const filters = [
    { value: "all", label: c.filters.all },
    { value: "free", label: c.filters.free, icon: "grid_view" as const },
    { value: "used", label: c.filters.used, icon: "person" as const },
  ];

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <h1 className="text-h2 font-extrabold">{c.title}</h1>

      <Card className="p-5 flex flex-wrap items-center gap-3">
        <Button>{c.buttons.primary}</Button>
        <Button variant="tonal">{c.buttons.tonal}</Button>
        <Button variant="outlined" icon="add">
          {c.buttons.outlined}
        </Button>
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
        <Avatar name="Lê Thị Bình" color="var(--accent-orange)" />
        {TIERS.map((t) => (
          <RoleBadge key={t} tier={t} />
        ))}
      </Card>

      <Card className="p-5 flex flex-col gap-3">
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
