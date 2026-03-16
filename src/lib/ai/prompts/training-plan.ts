import type { OnboardingAnswers } from "@/types";

export function buildPlanGenerationPrompt(answers: OnboardingAnswers, startDate?: Date): string {
  const {
    sport,
    experience_level,
    goal_event,
    goal_date,
    goal_time,
    current_weekly_volume_km,
    available_days,
    max_session_duration,
    injuries_constraints,
    equipment_available,
    additional_context,
    plan_duration_weeks,
  } = answers;

  const sportLabel =
    sport === "marathon"
      ? "Marathon"
      : sport === "triathlon"
      ? "Triathlon"
      : "HYROX";

  const planStart = startDate ?? new Date();
  const endDate = new Date(planStart.getTime());
  endDate.setDate(endDate.getDate() + plan_duration_weeks * 7);

  return `Generate a complete ${plan_duration_weeks}-week ${sportLabel} training plan for the following athlete.

## Athlete Profile

- **Sport**: ${sportLabel}
- **Experience Level**: ${experience_level}
- **Goal Event**: ${goal_event || "General fitness / race preparation"}
- **Goal Date**: ${goal_date || "Not specified"}
- **Goal Time / Finish Target**: ${goal_time || "Completion / personal best"}
- **Current Weekly Volume**: ${current_weekly_volume_km > 0 ? `${current_weekly_volume_km} km/week` : "Not specified / beginner"}
- **Available Training Days**: ${available_days.join(", ")}
- **Max Session Duration**: ${max_session_duration} minutes
- **Injuries / Constraints**: ${injuries_constraints || "None reported"}
- **Available Equipment**: ${equipment_available || "Standard gym + outdoor access"}
- **Additional Context**: ${additional_context || "None"}

## Plan Requirements

1. Start date: ${planStart.toISOString().split("T")[0]}
2. Duration: ${plan_duration_weeks} weeks (${plan_duration_weeks * 7} days)
3. Only schedule sessions on these days: ${available_days.join(", ")}
4. Never exceed ${max_session_duration} minutes per session
5. Apply periodization appropriate for the event and timeline
6. Include a taper week if the goal date allows
7. Progressive overload: increase volume no more than 10% per week
8. Include at least 1 full rest day per week
${
  sport === "marathon"
    ? `9. Mix: long run, tempo run, easy runs, optional strength work
10. Long run should be on ${available_days.includes("Sunday") ? "Sunday" : available_days[available_days.length - 1]}`
    : ""
}
${
  sport === "triathlon"
    ? `9. Balance swim/bike/run with appropriate brick sessions
10. Don't stack swim and strength on same day for beginners
11. For brick sessions: always include both bike and run distances in the description (e.g. "40km bike at Z2, transition, then 10km run at Z3"). Set distance to total combined km.`
    : ""
}
${
  sport === "hyrox"
    ? `9. Alternate station-focused days with running days
10. Include grip/carry work, wall ball practice, sled simulation`
    : ""
}

Generate ALL sessions for all ${plan_duration_weeks} weeks. Use date_offset (0-indexed from start) for each session.

Return ONLY the JSON object. No markdown, no explanation.`;
}

export function buildModifyPlanPrompt(
  userRequest: string,
  currentPlanContext: string
): string {
  return `The athlete is requesting a modification to their training plan.

## Athlete Request
"${userRequest}"

## Current Plan Context
${currentPlanContext}

## Instructions
1. Understand what the athlete needs
2. Suggest specific modifications (which sessions to change, how)
3. Explain the coaching rationale
4. If modifying sessions, provide updated session details in your response
5. Be empathetic — life happens, and adapting is part of good coaching

If plan modifications are needed, include a JSON block in your response:
\`\`\`json
{
  "modifications": [
    {
      "type": "reschedule" | "replace" | "add" | "remove" | "adjust",
      "sessionId": "session_id or null for new",
      "changes": { ...session fields },
      "reason": "brief explanation"
    }
  ]
}
\`\`\`

Otherwise, respond with coaching advice only.`;
}
