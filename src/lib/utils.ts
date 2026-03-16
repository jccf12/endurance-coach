import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, addDays, startOfWeek, endOfWeek } from "date-fns";
import type { SessionType, Intensity, TrainingSession, WeekData } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sport color mapping
export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  run: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  bike: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  swim: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  strength: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  brick: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  hyrox: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  functional: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  rest: "text-slate-400 bg-slate-400/10 border-slate-400/30",
  "cross-training": "text-teal-400 bg-teal-400/10 border-teal-400/30",
};

export const INTENSITY_COLORS: Record<Intensity, string> = {
  recovery: "text-slate-400",
  easy: "text-green-400",
  moderate: "text-yellow-400",
  hard: "text-orange-400",
  "race-pace": "text-red-400",
};

export const SESSION_TYPE_ICONS: Record<SessionType, string> = {
  run: "🏃",
  bike: "🚴",
  swim: "🏊",
  strength: "💪",
  brick: "🔥",
  hyrox: "⚡",
  functional: "🎯",
  rest: "😴",
  "cross-training": "🤸",
};

export function formatDate(dateString: string, fmt = "MMM d, yyyy"): string {
  try {
    return format(parseISO(dateString), fmt);
  } catch {
    return dateString;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatDistance(distance: number, unit: "km" | "mi" = "km"): string {
  return `${distance}${unit}`;
}

export function groupSessionsByWeek(sessions: TrainingSession[]): WeekData[] {
  const weekMap = new Map<number, TrainingSession[]>();

  for (const session of sessions) {
    const week = session.week_number;
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week)!.push(session);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, weekSessions]) => {
      const sorted = weekSessions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstDate = sorted[0]?.date ?? "";
      const lastDate = sorted[sorted.length - 1]?.date ?? "";
      const totalVolume = sorted.reduce((sum, s) => sum + (s.distance ?? 0), 0);
      const totalDuration = sorted.reduce(
        (sum, s) => sum + (s.duration_minutes ?? 0),
        0
      );

      return {
        weekNumber,
        startDate: firstDate,
        endDate: lastDate,
        sessions: sorted,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalDuration,
      };
    });
}

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const SPORTS_CONFIG = {
  marathon: {
    label: "Marathon",
    emoji: "🏃",
    description: "Road running race, 42.195 km",
    color: "text-sky-400",
  },
  triathlon: {
    label: "Triathlon",
    emoji: "🏊🚴🏃",
    description: "Swim, bike, run multisport",
    color: "text-violet-400",
  },
  hyrox: {
    label: "HYROX",
    emoji: "⚡",
    description: "Fitness racing with functional movements",
    color: "text-yellow-400",
  },
};
