import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersView } from "@/sections/platform/UsersView";

export default async function UsersPage() {
  const s = await requireStaff();
  const sb = await createClient();
  const { data: users } = await sb.from("profiles").select("*").order("name");
  return <UsersView users={(users ?? []) as any} meId={s.userId} isAdmin={s.role === "admin"} />;
}