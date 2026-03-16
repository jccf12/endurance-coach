import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId") ?? "";

  const state = JSON.stringify({ userId: user.id, planId });
  const authUrl = getAuthUrl(Buffer.from(state).toString("base64"));

  return NextResponse.redirect(authUrl);
}
