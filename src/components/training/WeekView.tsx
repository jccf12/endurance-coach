"use client";

import { SessionCard } from "./SessionCard";
import { formatDate, formatDuration, SESSION_TYPE_ICONS } from "@/lib/utils";
import type { WeekData, SessionType, TrainingSession } from "@/types";

interface WeekViewProps {
  week: WeekData;
  onToggleComplete?: (sessionId: string, completed: boolean) => void;
  onUpdate?: (id: string, updates: { description?: string | null; duration_minutes?: number | null }) => Promise<void>;
  isCurrentWeek?: boolean;
}

const DISCIPLINE_TYPES: SessionType[] = ["run", "bike", "swim"];

export function WeekView({ week, onToggleComplete, onUpdate, isCurrentWeek }: WeekViewProps) {
  const completedSessions = week.sessions.filter(
    (s) => s.completed && s.session_type !== "rest"
  ).length;
  const totalSessions = week.sessions.filter((s) => s.session_type !== "rest").length;

  // Per-discipline km breakdown (only types with distance)
  const disciplineVolumes: Partial<Record<SessionType, number>> = {};
  for (const s of week.sessions) {
    if (!s.distance || s.session_type === "rest") continue;
    const type = s.session_type as SessionType;
    disciplineVolumes[type] = (disciplineVolumes[type] ?? 0) + s.distance;
  }
  const disciplineEntries = Object.entries(disciplineVolumes) as [SessionType, number][];
  // Show breakdown only if more than one discipline has distance
  const showBreakdown = disciplineEntries.length > 1;

  return (
    <div className="space-y-3">
      {/* Week header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">
              Week {week.weekNumber}
            </h3>
            {isCurrentWeek && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                Current
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(week.startDate, "MMM d")} – {formatDate(week.endDate, "MMM d")}
          </p>
        </div>
        <div className="text-right">
          {showBreakdown ? (
            <div className="flex flex-col items-end gap-0.5">
              {disciplineEntries.map(([type, km]) => (
                <p key={type} className="text-xs text-muted-foreground">
                  {SESSION_TYPE_ICONS[type]} {Math.round(km * 10) / 10} km
                </p>
              ))}
            </div>
          ) : week.totalVolume > 0 ? (
            <p className="text-sm font-semibold text-foreground">{week.totalVolume} km</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {completedSessions}/{totalSessions} done
            {week.totalDuration > 0 && ` · ${formatDuration(week.totalDuration)}`}
          </p>
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-2">
        {week.sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onToggleComplete={onToggleComplete}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
