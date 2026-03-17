import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingAnswers } from "@/types";
import { addDays } from "date-fns";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const answers = await request.json() as OnboardingAnswers;

  if (!answers.sport || !answers.experience_level) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  let startDate = new Date();
  if (answers.goal_date) {
    const raceDate = new Date(answers.goal_date);
    const computedStart = addDays(raceDate, -(answers.plan_duration_weeks * 7));
    if (computedStart > startDate) startDate = computedStart;
  }

  const endDate = addDays(startDate, answers.plan_duration_weeks * 7);

  const { data: sportProfile } = await supabase
    .from("user_sport_profiles")
    .insert({
      user_id: user.id,
      sport: answers.sport,
      experience_level: answers.experience_level,
      current_weekly_volume_km: answers.current_weekly_volume_km,
      goal_event: answers.goal_event || null,
      goal_date: answers.goal_date || null,
      goal_time: answers.goal_time || null,
      available_days: answers.available_days,
      max_session_duration: answers.max_session_duration,
      injuries_constraints: answers.injuries_constraints || null,
      equipment_available: answers.equipment_available || null,
      additional_context: answers.additional_context || null,
    })
    .select()
    .single();

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: user.id,
      sport_profile_id: sportProfile?.id ?? null,
      name: "Building your plan…",
      sport: answers.sport,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      goal: null,
      status: "draft",
      total_weeks: answers.plan_duration_weeks,
    })
    .select()
    .single();

  if (planError) {
    return Response.json({ error: planError.message }, { status: 500 });
  }

  return Response.json({ planId: plan.id });
}
