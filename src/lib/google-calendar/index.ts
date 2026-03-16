import { google } from "googleapis";
import type { TrainingSession } from "@/types";
import { SESSION_TYPE_ICONS } from "@/lib/utils";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`
  );
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent",
    state: state ?? "",
  });
}

export async function exchangeCode(code: string) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function createCalendarEvents(
  accessToken: string,
  refreshToken: string,
  sessions: TrainingSession[],
  calendarId = "primary"
): Promise<{ created: number; failed: number }> {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  let created = 0;
  let failed = 0;

  for (const session of sessions) {
    if (session.session_type === "rest") continue;
    if (session.google_calendar_event_id) continue; // already synced

    try {
      const icon = SESSION_TYPE_ICONS[session.session_type] ?? "🏃";
      const durationMins = session.duration_minutes ?? 60;

      // Create event time (default 7am, duration from session)
      const startDateTime = new Date(`${session.date}T07:00:00`);
      const endDateTime = new Date(startDateTime.getTime() + durationMins * 60 * 1000);

      const description = [
        session.description ?? "",
        "",
        session.duration_minutes ? `Duration: ${session.duration_minutes} min` : "",
        session.distance ? `Distance: ${session.distance} ${session.distance_unit}` : "",
        session.intensity ? `Intensity: ${session.intensity}` : "",
        session.heart_rate_zone ? `HR Zone: ${session.heart_rate_zone}` : "",
        session.pace_target ? `Pace: ${session.pace_target}` : "",
        session.notes ? `\nCoach notes: ${session.notes}` : "",
        "\n🏅 Created by EnduranceAI",
      ]
        .filter(Boolean)
        .join("\n");

      await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: `${icon} ${session.title}`,
          description,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: "UTC",
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: "UTC",
          },
          colorId: getColorId(session.intensity),
        },
      });

      created++;
    } catch {
      failed++;
    }
  }

  return { created, failed };
}

export async function createSingleCalendarEvent(
  accessToken: string,
  refreshToken: string,
  session: TrainingSession,
  calendarId = "primary"
): Promise<string | null> {
  if (session.session_type === "rest") return null;

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const icon = SESSION_TYPE_ICONS[session.session_type] ?? "🏃";
  const durationMins = session.duration_minutes ?? 60;
  const startDateTime = new Date(`${session.date}T07:00:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMins * 60 * 1000);

  const description = [
    session.description ?? "",
    "",
    session.duration_minutes ? `Duration: ${session.duration_minutes} min` : "",
    session.distance ? `Distance: ${session.distance} ${session.distance_unit}` : "",
    session.intensity ? `Intensity: ${session.intensity}` : "",
    session.heart_rate_zone ? `HR Zone: ${session.heart_rate_zone}` : "",
    session.pace_target ? `Pace: ${session.pace_target}` : "",
    session.notes ? `\nCoach notes: ${session.notes}` : "",
    "\n🏅 Created by EnduranceAI",
  ].filter(Boolean).join("\n");

  try {
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${icon} ${session.title}`,
        description,
        start: { dateTime: startDateTime.toISOString(), timeZone: "UTC" },
        end: { dateTime: endDateTime.toISOString(), timeZone: "UTC" },
        colorId: getColorId(session.intensity),
      },
    });
    return event.data.id ?? null;
  } catch {
    return null;
  }
}

export async function updateCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  session: TrainingSession,
  calendarId = "primary"
): Promise<void> {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const icon = SESSION_TYPE_ICONS[session.session_type] ?? "🏃";
  const durationMins = session.duration_minutes ?? 60;
  const startDateTime = new Date(`${session.date}T07:00:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMins * 60 * 1000);

  const description = [
    session.description ?? "",
    "",
    session.duration_minutes ? `Duration: ${session.duration_minutes} min` : "",
    session.distance ? `Distance: ${session.distance} ${session.distance_unit}` : "",
    session.intensity ? `Intensity: ${session.intensity}` : "",
    session.heart_rate_zone ? `HR Zone: ${session.heart_rate_zone}` : "",
    session.pace_target ? `Pace: ${session.pace_target}` : "",
    session.notes ? `\nCoach notes: ${session.notes}` : "",
    "\n🏅 Created by EnduranceAI",
  ].filter(Boolean).join("\n");

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: {
      summary: `${icon} ${session.title}`,
      description,
      start: { dateTime: startDateTime.toISOString(), timeZone: "UTC" },
      end: { dateTime: endDateTime.toISOString(), timeZone: "UTC" },
      colorId: getColorId(session.intensity),
    },
  });
}

export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<void> {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.events.delete({ calendarId, eventId });
}

function getColorId(intensity: string | null): string {
  // Google Calendar color IDs
  switch (intensity) {
    case "recovery": return "8"; // graphite
    case "easy": return "2"; // sage/green
    case "moderate": return "5"; // banana/yellow
    case "hard": return "6"; // tangerine/orange
    case "race-pace": return "11"; // tomato/red
    default: return "1"; // lavender
  }
}
