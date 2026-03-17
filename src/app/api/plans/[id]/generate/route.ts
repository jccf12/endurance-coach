import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/ai";
import type { OnboardingAnswers } from "@/types";
import { addDays } from "date-fns";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      `data: ${JSON.stringify({ error: "Unauthorized" })}\n\ndata: [DONE]\n\n`,
      { status: 401, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { data: plan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!plan) {
    return new Response(
      `data: ${JSON.stringify({ error: "Plan not found" })}\n\ndata: [DONE]\n\n`,
      { status: 404, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Already generated — nothing to do
  if (plan.status !== "draft") {
    return new Response(
      `data: ${JSON.stringify({ status: "done", planId: plan.id })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const { data: sportProfile } = await supabase
    .from("user_sport_profiles")
    .select("*")
    .eq("id", plan.sport_profile_id)
    .single();

  const startDate = new Date(plan.start_date);

  const answers: OnboardingAnswers = {
    sport: plan.sport,
    experience_level: sportProfile?.experience_level ?? "intermediate",
    goal_event: sportProfile?.goal_event ?? "",
    goal_date: sportProfile?.goal_date ?? "",
    goal_time: sportProfile?.goal_time ?? "",
    current_weekly_volume_km: sportProfile?.current_weekly_volume_km ?? 0,
    available_days: sportProfile?.available_days ?? [],
    max_session_duration: sportProfile?.max_session_duration ?? 90,
    injuries_constraints: sportProfile?.injuries_constraints ?? "",
    equipment_available: sportProfile?.equipment_available ?? "",
    additional_context: sportProfile?.additional_context ?? "",
    plan_duration_weeks: plan.total_weeks,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        send({ status: "generating", message: "Your AI coach is designing your plan…" });

        let charsSeen = 0;
        const onChunk = (text: string) => {
          charsSeen += text.length;
          if (charsSeen % 2000 < text.length) {
            send({ status: "generating", progress: charsSeen });
          }
        };

        const { result, modelUsed } = await generateTrainingPlan(answers, undefined, onChunk, startDate);

        send({ status: "saving", message: "Saving your plan…" });

        await supabase
          .from("training_plans")
          .update({
            name: result.plan.name,
            goal: result.plan.goal,
            status: "active",
            ai_model_used: modelUsed,
            metadata: {
              overview: result.plan.overview,
              key_principles: result.plan.key_principles,
            },
          })
          .eq("id", id);

        const sessionRows = result.sessions.map((s) => ({
          plan_id: id,
          user_id: user.id,
          date: addDays(startDate, s.date_offset).toISOString().split("T")[0],
          week_number: s.week_number,
          day_of_week: s.day_of_week,
          session_type: s.session_type,
          title: s.title,
          description: s.description || null,
          duration_minutes: s.duration_minutes ?? null,
          distance: s.distance ?? null,
          distance_unit: s.distance_unit ?? "km",
          intensity: s.intensity || null,
          heart_rate_zone: s.heart_rate_zone || null,
          pace_target: s.pace_target || null,
          notes: s.notes || null,
          completed: false,
        }));

        const BATCH_SIZE = 50;
        for (let i = 0; i < sessionRows.length; i += BATCH_SIZE) {
          const { error } = await supabase
            .from("training_sessions")
            .insert(sessionRows.slice(i, i + BATCH_SIZE));
          if (error) throw error;
        }

        send({ status: "done", planId: id });
      } catch (err: unknown) {
        console.error("Plan generation error:", err);
        send({ error: err instanceof Error ? err.message : "Failed to generate plan" });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
