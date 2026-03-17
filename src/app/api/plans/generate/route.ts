import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/ai";
import type { OnboardingAnswers } from "@/types";
import { addDays } from "date-fns";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(
      `data: ${JSON.stringify({ error: "Unauthorized" })}\n\ndata: [DONE]\n\n`,
      { status: 401, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const answers = await request.json() as OnboardingAnswers;

  if (!answers.sport || !answers.experience_level) {
    return new Response(
      `data: ${JSON.stringify({ error: "Missing required fields" })}\n\ndata: [DONE]\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        send({ status: "generating", message: "Your AI coach is designing your plan…" });

        // Track approximate progress by counting JSON chars as they arrive
        let charsSeen = 0;
        const onChunk = (text: string) => {
          charsSeen += text.length;
          // Send a heartbeat every ~2000 chars so the connection stays alive
          if (charsSeen % 2000 < text.length) {
            send({ status: "generating", progress: charsSeen });
          }
        };

        // If a race date is provided, start the plan so it ends on race day
        let startDate = new Date();
        if (answers.goal_date) {
          const raceDate = new Date(answers.goal_date);
          const computedStart = addDays(raceDate, -(answers.plan_duration_weeks * 7));
          if (computedStart > startDate) startDate = computedStart;
        }

        const { result, modelUsed } = await generateTrainingPlan(answers, undefined, onChunk, startDate);

        send({ status: "saving", message: "Saving your plan…" });

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
            name: result.plan.name,
            sport: answers.sport,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            goal: result.plan.goal,
            status: "active",
            total_weeks: answers.plan_duration_weeks,
            ai_model_used: modelUsed,
            metadata: {
              overview: result.plan.overview,
              key_principles: result.plan.key_principles,
            },
          })
          .select()
          .single();

        if (planError) throw planError;

        const sessionRows = result.sessions.map((s) => ({
          plan_id: plan.id,
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
          const { error } = await supabase.from("training_sessions").insert(sessionRows.slice(i, i + BATCH_SIZE));
          if (error) throw error;
        }

        send({
          status: "done",
          planId: plan.id,
          plan: { name: result.plan.name, goal: result.plan.goal, overview: result.plan.overview },
        });
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
