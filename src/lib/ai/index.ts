import { COACHING_SYSTEM_PROMPT, PLAN_GENERATION_SYSTEM_PROMPT } from "./prompts/system";
import { buildPlanGenerationPrompt, buildModifyPlanPrompt } from "./prompts/training-plan";
import { anthropicChat, anthropicGeneratePlan, getClient } from "./providers/anthropic";
import { openaiGeneratePlan, openaiChat } from "./providers/openai";
import { COACH_TOOLS, executeCoachTool, type ToolExecutionResult, type PlanProposal } from "./coach-tools";
import type { OnboardingAnswers, TrainingSession } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

type AIProvider = "anthropic" | "openai";

function getProvider(): AIProvider {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER as AIProvider;
  // Fall back based on available keys
  if (provider === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

export interface GeneratedPlan {
  plan: {
    name: string;
    goal: string;
    overview: string;
    key_principles: string[];
  };
  sessions: Array<{
    week_number: number;
    day_of_week: number;
    date_offset: number;
    session_type: string;
    title: string;
    description: string;
    duration_minutes: number | null;
    distance: number | null;
    distance_unit: "km";
    intensity: string;
    heart_rate_zone: string | null;
    pace_target: string | null;
    notes: string | null;
  }>;
}

export async function generateTrainingPlan(
  answers: OnboardingAnswers,
  provider?: AIProvider,
  onChunk?: (text: string) => void,
  startDate?: Date
): Promise<{ result: GeneratedPlan; modelUsed: string }> {
  const p = provider ?? getProvider();
  const userPrompt = buildPlanGenerationPrompt(answers, startDate);

  let rawText: string;
  let modelUsed: string;

  if (p === "anthropic") {
    rawText = await anthropicGeneratePlan(PLAN_GENERATION_SYSTEM_PROMPT, userPrompt, onChunk);
    modelUsed = "claude-sonnet-4-6";
  } else {
    rawText = await openaiGeneratePlan(PLAN_GENERATION_SYSTEM_PROMPT, userPrompt);
    modelUsed = "gpt-4o";
  }

  // Strip any markdown code fences if present
  const jsonText = rawText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  // Try parsing; if it fails, attempt to extract JSON-like substring and repair common issues
  try {
    const result = JSON.parse(jsonText) as GeneratedPlan;
    return { result, modelUsed };
  } catch (err) {
    // Helper: extract balanced JSON starting at first brace/bracket
    function extractBalanced(text: string) {
      const startIdx = Math.min(
        ...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0)
      );
      if (startIdx < 0) return null;
      const openChar = text[startIdx];
      const closeChar = openChar === "{" ? "}" : "]";
      let depth = 0;
      for (let i = startIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;
        if (depth === 0) return text.slice(startIdx, i + 1);
      }
      return null;
    }

    // Attempt extraction
    const extracted = extractBalanced(rawText) ?? extractBalanced(jsonText);
    let candidate = extracted ?? jsonText;

    // Common repairs: replace smart quotes, remove trailing commas
    candidate = candidate.replace(/[\u2018\u2019\u201C\u201D]/g, '"');
    candidate = candidate.replace(/,\s*([}\]])/g, "$1");

    try {
      const result = JSON.parse(candidate) as GeneratedPlan;
      return { result, modelUsed };
    } catch (err2) {
      // Attempt to heuristically repair common truncation issues (unterminated strings/braces)
      function repairTruncated(text: string) {
        let t = text;
        // Replace smart quotes again
        t = t.replace(/[\u2018\u2019\u201C\u201D]/g, '"');

        // Count unescaped double quotes
        let quoteCount = 0;
        for (let i = 0; i < t.length; i++) {
          if (t[i] === '"') {
            const prev = t[i - 1];
            if (prev !== '\\') quoteCount++;
          }
        }
        if (quoteCount % 2 === 1) {
          t = t + '"';
        }

        // Balance braces/brackets by appending closing chars
        const openers: Record<string, number> = { '{': 0, '[': 0 };
        for (let i = 0; i < t.length; i++) {
          const ch = t[i];
          if (ch === '{') openers['{']++;
          else if (ch === '}') openers['{']--;
          else if (ch === '[') openers['[']++;
          else if (ch === ']') openers['[']--;
        }
        while (openers['['] > 0) {
          t += ']';
          openers['[']--;
        }
        while (openers['{'] > 0) {
          t += '}';
          openers['{']--;
        }

        // Remove trailing commas before closers just in case
        t = t.replace(/,\s*([}\]])/g, "$1");
        return t;
      }

      const repaired = repairTruncated(candidate);
      try {
        const result = JSON.parse(repaired) as GeneratedPlan;
        return { result, modelUsed };
      } catch (err3) {
        // Include the raw model output to aid debugging
        const snippet = (rawText || jsonText || candidate).slice(0, 20000);
        const message = `Failed to parse AI output as JSON. Original parse error: ${
          err instanceof Error ? err.message : String(err)
        }. Repair attempt error: ${
          err3 instanceof Error ? err3.message : String(err3)
        }. Extracted snippet:\n${snippet}`;
        throw new Error(message);
      }
    }
  }
}

export type CoachStreamEvent =
  | { type: "text"; text: string }
  | { type: "plan_updated"; action: "modified" | "added" | "removed"; sessionTitle: string }
  | { type: "plan_proposal"; proposal: PlanProposal };

export async function* streamCoachingChatWithTools(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  planContext: string | undefined,
  planId: string | undefined,
  supabase: SupabaseClient,
  userId: string
): AsyncGenerator<CoachStreamEvent> {
  const systemPrompt = planContext
    ? `${COACHING_SYSTEM_PROMPT}\n\n## Current Training Plan Context\n${planContext}`
    : COACHING_SYSTEM_PROMPT;

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // First streaming request — Claude may emit text and/or decide to use tools
  const stream1 = await getClient().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    tools: COACH_TOOLS,
    tool_choice: { type: "auto" },
    messages: anthropicMessages,
  });

  for await (const event of stream1) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }

  const finalMessage1 = await stream1.finalMessage();
  const toolUseBlocks = finalMessage1.content.filter(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );

  if (toolUseBlocks.length === 0) return;

  // Execute tools and collect results
  const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const block of toolUseBlocks) {
    const result: ToolExecutionResult = await executeCoachTool(
      block.name,
      block.input as Record<string, unknown>,
      supabase,
      userId
    );

    if (result.success && result.proposal) {
      yield { type: "plan_proposal", proposal: result.proposal };
    } else if (result.success && result.action && result.sessionTitle) {
      yield { type: "plan_updated", action: result.action, sessionTitle: result.sessionTitle };
    }

    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: result.message,
    });
  }

  // Second streaming request with tool results — Claude gives the final coaching response
  const messages2: Anthropic.MessageParam[] = [
    ...anthropicMessages,
    { role: "assistant", content: finalMessage1.content },
    { role: "user", content: toolResults },
  ];

  const stream2 = await getClient().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    tools: COACH_TOOLS,
    messages: messages2,
  });

  for await (const event of stream2) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildPlanContext(
  planName: string,
  sport: string,
  goal: string,
  upcomingSessions: TrainingSession[],
  planId?: string
): string {
  const sessionLines = upcomingSessions
    .slice(0, 28)
    .map(
      (s) =>
        `- [id:${s.id}] ${s.date} (${DAY_NAMES[s.day_of_week]}) Wk${s.week_number}: ${s.title} | ${s.session_type} | ${s.duration_minutes ?? "?"}min | ${s.intensity ?? "?"}`
    )
    .join("\n");

  return [
    `Plan: ${planName}`,
    `Sport: ${sport}`,
    `Goal: ${goal}`,
    planId ? `Plan ID: ${planId}` : null,
    `\nUpcoming sessions (include the id: field when calling modify_session or remove_session):`,
    sessionLines || "No upcoming sessions",
  ]
    .filter(Boolean)
    .join("\n");
}
