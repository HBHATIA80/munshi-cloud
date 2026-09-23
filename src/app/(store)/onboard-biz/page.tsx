import { requireSession } from "@/lib/auth";
import { OnboardBizForm } from "@/sections/auth/OnboardBizForm";

export default async function OnboardBizPage({ searchParams }:
  { searchParams: Promise<{ name?: string }> }) {
  const s = await requireSession();
  const { name } = await searchParams;
  return <OnboardBizForm ownerName={s.name} presetName={name ?? ""} />;
}