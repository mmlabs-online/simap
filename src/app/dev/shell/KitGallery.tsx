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

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "free", label: "Còn trống", icon: "grid_view" as const },
  { value: "used", label: "Đang dùng", icon: "person" as const },
];

/** Every kit component on one page, for the manual light/dark check. Dev-only. */
export function KitGallery() {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <h1 className="text-h2 font-extrabold">Bộ giao diện</h1>

      <Card className="p-5 flex flex-wrap items-center gap-3">
        <Button>Chính</Button>
        <Button variant="tonal">Phụ</Button>
        <Button variant="outlined" icon="add">
          Viền
        </Button>
        <Button variant="text">Văn bản</Button>
        <Button variant="danger">Nguy hiểm</Button>
        <Button disabled>Vô hiệu</Button>
        <IconButton icon="search" label="Tìm kiếm" />
        <IconButton icon="mail" label="Thư" active />
      </Card>

      <Card className="p-5 flex flex-wrap items-center gap-3">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Lọc" />
        <Chip label="Nhóm A" icon="group" />
        <Avatar name="Nguyễn Văn An" />
        <Avatar name="Lê Thị Bình" color="var(--accent-orange)" />
        {TIERS.map((t) => (
          <RoleBadge key={t} tier={t} />
        ))}
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <FilledInput aria-label="Tìm kiếm" placeholder="Tìm phòng, thành viên…" />
        <div>
          <Button onClick={() => setOpen(true)}>Mở hộp thoại</Button>
        </div>
      </Card>

      <EntityFormDialog
        open={open}
        title="Thêm phòng"
        subtitle="Nhập thông tin phòng mới."
        submitLabel="Lưu"
        onClose={() => setOpen(false)}
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <DialogField label="Mã phòng" icon="meeting_room" placeholder="A1" />
        <DialogSelect label="Loại" icon="group">
          <option>Họp</option>
          <option>Làm việc</option>
        </DialogSelect>
      </EntityFormDialog>
    </div>
  );
}
