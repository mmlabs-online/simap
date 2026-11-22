import { notFound } from "next/navigation";

// Dev-only room map demo (SIM-024.1). The import stays inside this branch so production has no demo chunk.
export default async function DevRoomMapPage() {
  if (process.env.NODE_ENV === "development") {
    const { RoomMapDemo } = await import("./RoomMapDemo");
    return <RoomMapDemo />;
  }
  notFound();
}
