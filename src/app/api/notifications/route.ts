import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const s = await requireSession();
  const sb = await createClient();
  const [{ data: items }, { count }] = await Promise.all([
    sb.from("notifications").select("*").eq("user_id", s.userId)
      .order("created_at", { ascending: false }).limit(15),
    sb.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", s.userId).eq("status", "queued"),
  ]);
  return NextResponse.json({ items: items ?? [], unread: count ?? 0 });
}

export async function POST() {
  const s = await requireSession();
  const sb = await createClient();
  await sb.from("notifications").update({ status: "read" })
    .eq("user_id", s.userId).eq("status", "queued");
  return NextResponse.json({ ok: true });
}