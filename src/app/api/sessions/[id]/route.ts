import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCalendarEvent } from "@/lib/google-calendar";
import type { TrainingSession } from "@/types";

// PATCH /api/sessions/[id] — toggle complete, update details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const updates = await request.json();
  const allowed = [
    "completed", "completed_at", "title", "description",
    "duration_minutes", "distance", "intensity", "notes", "date",
  ];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowed.includes(key))
  );

  const { data, error } = await supabase
    .from("training_sessions")
    .update({ ...filtered, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // Sync with Google Calendar if the session has an event and calendar is connected
  const session = data as TrainingSession;
  if (session.google_calendar_event_id) {
    try {
      const { data: tokens } = await supabase
        .from("google_calendar_tokens")
        .select("access_token, refresh_token, calendar_id")
        .eq("user_id", user.id)
        .single();

      if (tokens) {
        await updateCalendarEvent(
          tokens.access_token,
          tokens.refresh_token,
          session.google_calendar_event_id,
          session,
          tokens.calendar_id ?? "primary"
        );
      }
    } catch {
      // Calendar sync is non-fatal
    }
  }

  return NextResponse.json(data);
}
