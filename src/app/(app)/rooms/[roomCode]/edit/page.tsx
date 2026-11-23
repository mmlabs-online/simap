import { LayoutEditorPage } from "@/ui";

export default async function RoomEditorPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <LayoutEditorPage key={roomCode} roomCode={roomCode} />;
}
