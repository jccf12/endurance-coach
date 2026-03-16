import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/profile?error=calendar_denied`);
  }

  let planId = "";
  let userId = "";
  try {
    const state = JSON.parse(Buffer.from(stateB64, "base64").toString());
    planId = state.planId ?? "";
    userId = state.userId ?? "";
  } catch {
    return NextResponse.redirect(`${origin}/profile?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    const supabase = await createClient();

    // Upsert tokens
    await supabase.from("google_calendar_tokens").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Redirect back to plan or profile
    const redirectUrl = planId
      ? `${origin}/plan/${planId}?calendarConnected=true`
      : `${origin}/profile?calendarConnected=true`;

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Calendar callback error:", err);
    return NextResponse.redirect(`${origin}/profile?error=calendar_failed`);
  }
}
