import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvents } from "@/lib/google-calendar";
import type { TrainingSession } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { planId } = await request.json() as { planId: string };

  if (!planId) {
    return NextResponse.json({ message: "planId is required" }, { status: 400 });
  }

  // Get calendar tokens
  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenData) {
    return NextResponse.json(
      { message: "Google Calendar not connected" },
      { status: 401 }
    );
  }

  // Get sessions to sync (not yet synced, not rest days)
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("plan_id", planId)
    .eq("user_id", user.id)
    .is("google_calendar_event_id", null)
    .neq("session_type", "rest")
    .order("date");

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ created: 0, message: "No sessions to sync" });
  }

  const { created, failed } = await createCalendarEvents(
    tokenData.access_token,
    tokenData.refresh_token,
    sessions as TrainingSession[],
    tokenData.calendar_id ?? "primary"
  );

  // Update token expiry (refresh may have happened)
  await supabase
    .from("google_calendar_tokens")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({ created, failed, total: sessions.length });
}
