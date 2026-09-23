// src/app/sa/toggle/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s?.isSuper) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, active } = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ status: active ? "suspended" : "active" }).eq("id", id);
  return NextResponse.json({ error: error?.message });
}