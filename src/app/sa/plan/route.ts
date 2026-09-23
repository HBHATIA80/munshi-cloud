// src/app/sa/plan/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s?.isSuper) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, plan } = await req.json();
  if (!["trial", "basic", "pro"].includes(plan)) return NextResponse.json({ error: "Bad plan" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update({ plan }).eq("id", id);
  return NextResponse.json({ error: error?.message });
}