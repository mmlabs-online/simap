import { SeatsPage } from "@/ui";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <SeatsPage key={roomCode} roomCode={roomCode} />;
}
