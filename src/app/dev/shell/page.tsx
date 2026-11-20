import { notFound } from "next/navigation";
import { TIERS, type Tier } from "@/lib/tier";
import { AppShellView } from "@/ui";
import { KitGallery } from "./KitGallery";

// Dev-only preview of the shell and UI kit (SIM-003). 404 in production builds.
export default async function DevShellPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { tier: raw } = await searchParams;
  const tier = TIERS.find((t): t is Tier => t === raw) ?? (raw === "none" ? null : "admin");

  return (
    <AppShellView
      session={
        tier ? { tier, email: "xem-truoc@example.invalid", orgName: "Tổ chức xem trước" } : null
      }
      pathname="/rooms"
      actions={{}}
    >
      <KitGallery />
    </AppShellView>
  );
}
