import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamCoachingChatWithTools, buildPlanContext } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message, planId, history = [] } = body as {
    message: string;
    planId?: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return NextResponse.json({ message: "Message is required" }, { status: 400 });
  }

  // Build plan context with session IDs if planId provided
  let planContext: string | undefined;
  if (planId) {
    const { data: plan } = await supabase
      .from("training_plans")
      .select("name, sport, goal")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("plan_id", planId)
      .eq("user_id", user.id)
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date")
      .limit(28);

    if (plan) {
      planContext = buildPlanContext(
        plan.name,
        plan.sport,
        plan.goal ?? "",
        sessions ?? [],
        planId
      );
    }
  }

  // Save user message
  await supabase.from("chat_messages").insert({
    user_id: user.id,
    plan_id: planId ?? null,
    role: "user",
    content: message,
  });

  const aiMessages = [
    ...history.slice(-8),
    { role: "user" as const, content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";

      try {
        const gen = streamCoachingChatWithTools(
          aiMessages,
          planContext,
          planId,
          supabase,
          user.id
        );

        for await (const event of gen) {
          if (event.type === "text") {
            fullContent += event.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.text })}\n\n`)
            );
          } else if (event.type === "plan_updated") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ plan_updated: { action: event.action, sessionTitle: event.sessionTitle } })}\n\n`
              )
            );
          } else if (event.type === "plan_proposal") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ plan_proposal: event.proposal })}\n\n`
              )
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        // Save assistant message (non-blocking)
        supabase.from("chat_messages").insert({
          user_id: user.id,
          plan_id: planId ?? null,
          role: "assistant",
          content: fullContent,
        }).then(() => {});
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Generation failed" })}\n\n`
          )
        );
      } finally {
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
