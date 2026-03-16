import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSingleCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import type { TrainingSession } from "@/types";

export const COACH_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "modify_session",
    description:
      "Modify an existing training session in the athlete's plan. Use this when the athlete asks to change a session's date, duration, intensity, type, or any other details.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The ID of the training session to modify",
        },
        changes: {
          type: "object",
          description: "The fields to update on the session",
          properties: {
            date: { type: "string", description: "New date in YYYY-MM-DD format" },
            title: { type: "string" },
            description: { type: "string" },
            duration_minutes: { type: "number" },
            session_type: {
              type: "string",
              enum: ["run", "bike", "swim", "strength", "brick", "hyrox", "functional", "rest", "cross-training"],
            },
            intensity: {
              type: "string",
              enum: ["recovery", "easy", "moderate", "hard", "race-pace"],
            },
            distance: { type: "number" },
            heart_rate_zone: { type: "string" },
            pace_target: { type: "string" },
            notes: { type: "string" },
          },
        },
        reason: {
          type: "string",
          description: "Brief explanation of why the session is being modified",
        },
      },
      required: ["session_id", "changes", "reason"],
    },
  },
  {
    name: "add_session",
    description:
      "Add a new training session to the athlete's plan. Use when the athlete wants to add an extra workout.",
    input_schema: {
      type: "object" as const,
      properties: {
        plan_id: { type: "string", description: "The plan ID to add the session to" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        week_number: { type: "number", description: "The week number within the plan" },
        day_of_week: { type: "number", description: "0=Sunday, 1=Monday, ..., 6=Saturday" },
        session_type: {
          type: "string",
          enum: ["run", "bike", "swim", "strength", "brick", "hyrox", "functional", "rest", "cross-training"],
        },
        title: { type: "string" },
        description: { type: "string" },
        duration_minutes: { type: "number" },
        intensity: {
          type: "string",
          enum: ["recovery", "easy", "moderate", "hard", "race-pace"],
        },
        distance: { type: "number" },
        heart_rate_zone: { type: "string" },
        pace_target: { type: "string" },
        notes: { type: "string" },
      },
      required: ["plan_id", "date", "week_number", "day_of_week", "session_type", "title", "duration_minutes", "intensity"],
    },
  },
  {
    name: "remove_session",
    description:
      "Remove a training session from the athlete's plan. Use when the athlete needs to cancel or skip a session entirely.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The ID of the session to remove",
        },
        reason: {
          type: "string",
          description: "Brief reason for removing the session",
        },
      },
      required: ["session_id", "reason"],
    },
  },
  {
    name: "propose_changes",
    description:
      "Propose a set of training plan changes for the athlete to review before applying. Use this instead of the individual tools when modifying 2 or more sessions, so the athlete can confirm before anything is committed.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "One-sentence explanation of why these changes are being proposed",
        },
        changes: {
          type: "array",
          description: "The list of proposed changes",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["modify", "add", "remove"],
              },
              session_id: {
                type: "string",
                description: "Required for modify and remove actions",
              },
              plan_id: {
                type: "string",
                description: "Required for add actions",
              },
              session_title: {
                type: "string",
                description: "Human-readable session title for display",
              },
              session_date: {
                type: "string",
                description: "Date of the session (YYYY-MM-DD)",
              },
              change_description: {
                type: "string",
                description: "Plain-English description of this specific change, e.g. 'Move to rest day' or 'Shorten to 30 min'",
              },
              modifications: {
                type: "object",
                description: "For modify: the fields to update (same as modify_session changes)",
              },
              new_session: {
                type: "object",
                description: "For add: full session data (same fields as add_session)",
              },
            },
            required: ["action", "session_title", "session_date", "change_description"],
          },
        },
      },
      required: ["summary", "changes"],
    },
  },
];

export type ProposedChange = {
  action: "modify" | "add" | "remove";
  session_id?: string;
  plan_id?: string;
  session_title: string;
  session_date: string;
  change_description: string;
  modifications?: Record<string, unknown>;
  new_session?: Record<string, unknown>;
};

export type PlanProposal = {
  summary: string;
  changes: ProposedChange[];
};

export type ToolExecutionResult = {
  success: boolean;
  message: string;
  action?: "modified" | "added" | "removed";
  sessionTitle?: string;
  proposal?: PlanProposal;
};

async function getCalendarTokens(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, calendar_id")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function executeCoachTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case "modify_session": {
      const { session_id, changes, reason } = toolInput as {
        session_id: string;
        changes: Partial<TrainingSession>;
        reason: string;
      };

      const { data: session, error: fetchError } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();

      if (fetchError || !session) {
        return { success: false, message: "Session not found or access denied" };
      }

      const { error: updateError } = await supabase
        .from("training_sessions")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", session_id)
        .eq("user_id", userId);

      if (updateError) {
        return { success: false, message: `Failed to update session: ${updateError.message}` };
      }

      // Sync with Google Calendar
      if (session.google_calendar_event_id) {
        try {
          const tokens = await getCalendarTokens(supabase, userId);
          if (tokens) {
            const updatedSession = { ...session, ...changes } as TrainingSession;
            await updateCalendarEvent(
              tokens.access_token,
              tokens.refresh_token,
              session.google_calendar_event_id,
              updatedSession,
              tokens.calendar_id ?? "primary"
            );
          }
        } catch {
          // Calendar update is non-fatal
        }
      }

      const title = (changes.title as string) ?? session.title;
      return {
        success: true,
        message: `Session "${title}" updated. Reason: ${reason}`,
        action: "modified",
        sessionTitle: title,
      };
    }

    case "add_session": {
      const input = toolInput as {
        plan_id: string;
        date: string;
        week_number: number;
        day_of_week: number;
        session_type: string;
        title: string;
        description?: string;
        duration_minutes: number;
        intensity: string;
        distance?: number;
        heart_rate_zone?: string;
        pace_target?: string;
        notes?: string;
      };

      // Verify the plan belongs to this user
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("id", input.plan_id)
        .eq("user_id", userId)
        .single();

      if (!plan) {
        return { success: false, message: "Plan not found or access denied" };
      }

      const { data: newSession, error: insertError } = await supabase
        .from("training_sessions")
        .insert({
          plan_id: input.plan_id,
          user_id: userId,
          date: input.date,
          week_number: input.week_number,
          day_of_week: input.day_of_week,
          session_type: input.session_type,
          title: input.title,
          description: input.description ?? null,
          duration_minutes: input.duration_minutes,
          distance: input.distance ?? null,
          distance_unit: "km",
          intensity: input.intensity,
          heart_rate_zone: input.heart_rate_zone ?? null,
          pace_target: input.pace_target ?? null,
          notes: input.notes ?? null,
          completed: false,
        })
        .select()
        .single();

      if (insertError || !newSession) {
        return { success: false, message: `Failed to add session: ${insertError?.message}` };
      }

      // Create Google Calendar event if connected
      if (input.session_type !== "rest") {
        try {
          const tokens = await getCalendarTokens(supabase, userId);
          if (tokens) {
            const eventId = await createSingleCalendarEvent(
              tokens.access_token,
              tokens.refresh_token,
              newSession as TrainingSession,
              tokens.calendar_id ?? "primary"
            );
            if (eventId) {
              await supabase
                .from("training_sessions")
                .update({ google_calendar_event_id: eventId })
                .eq("id", newSession.id);
            }
          }
        } catch {
          // Calendar creation is non-fatal
        }
      }

      return {
        success: true,
        message: `Session "${input.title}" added on ${input.date}`,
        action: "added",
        sessionTitle: input.title,
      };
    }

    case "remove_session": {
      const { session_id, reason } = toolInput as { session_id: string; reason: string };

      const { data: session, error: fetchError } = await supabase
        .from("training_sessions")
        .select("title, google_calendar_event_id")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();

      if (fetchError || !session) {
        return { success: false, message: "Session not found or access denied" };
      }

      // Delete Google Calendar event first
      if (session.google_calendar_event_id) {
        try {
          const tokens = await getCalendarTokens(supabase, userId);
          if (tokens) {
            await deleteCalendarEvent(
              tokens.access_token,
              tokens.refresh_token,
              session.google_calendar_event_id,
              tokens.calendar_id ?? "primary"
            );
          }
        } catch {
          // Calendar deletion is non-fatal
        }
      }

      const { error: deleteError } = await supabase
        .from("training_sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", userId);

      if (deleteError) {
        return { success: false, message: `Failed to remove session: ${deleteError.message}` };
      }

      return {
        success: true,
        message: `Session "${session.title}" removed. Reason: ${reason}`,
        action: "removed",
        sessionTitle: session.title,
      };
    }

    case "propose_changes": {
      const proposal = toolInput as PlanProposal;
      return {
        success: true,
        message: `Proposed ${proposal.changes.length} change(s): ${proposal.summary}`,
        proposal,
      };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

export async function applyProposedChanges(
  proposal: PlanProposal,
  supabase: SupabaseClient,
  userId: string
): Promise<{ applied: number; failed: number; results: ToolExecutionResult[] }> {
  const results: ToolExecutionResult[] = [];
  let applied = 0;
  let failed = 0;

  for (const change of proposal.changes) {
    let result: ToolExecutionResult;

    if (change.action === "modify" && change.session_id) {
      result = await executeCoachTool(
        "modify_session",
        { session_id: change.session_id, changes: change.modifications ?? {}, reason: change.change_description },
        supabase,
        userId
      );
    } else if (change.action === "add" && change.plan_id && change.new_session) {
      result = await executeCoachTool(
        "add_session",
        { plan_id: change.plan_id, ...change.new_session },
        supabase,
        userId
      );
    } else if (change.action === "remove" && change.session_id) {
      result = await executeCoachTool(
        "remove_session",
        { session_id: change.session_id, reason: change.change_description },
        supabase,
        userId
      );
    } else {
      result = { success: false, message: "Invalid change data" };
    }

    results.push(result);
    if (result.success) applied++;
    else failed++;
  }

  return { applied, failed, results };
}
