import { DeviceDetailPage } from "@/ui";

export default async function DeviceDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeviceDetailPage key={id} deviceId={id} />;
}
