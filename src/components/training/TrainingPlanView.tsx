"use client";

import { useState, useEffect, useRef } from "react";
import { WeekView } from "./WeekView";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { groupSessionsByWeek, formatDate } from "@/lib/utils";
import type { TrainingPlan, TrainingSession } from "@/types";
import { parseISO, isAfter, isBefore, isToday } from "date-fns";

interface TrainingPlanViewProps {
  plan: TrainingPlan;
  sessions: TrainingSession[];
  onToggleComplete?: (sessionId: string, completed: boolean) => void;
  onUpdate?: (id: string, updates: { description?: string | null; duration_minutes?: number | null }) => Promise<void>;
}

export function TrainingPlanView({ plan, sessions, onToggleComplete, onUpdate }: TrainingPlanViewProps) {
  const [tab, setTab] = useState("upcoming");
  const today = new Date();

  const weekData = groupSessionsByWeek(sessions);

  const currentWeekNumber = weekData.find((w) =>
    w.sessions.some((s) => {
      const d = parseISO(s.date);
      return !isBefore(d, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)) &&
        !isAfter(d, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6));
    })
  )?.weekNumber;

  const completedSessions = sessions.filter(
    (s) => s.completed && s.session_type !== "rest"
  ).length;
  const totalSessions = sessions.filter((s) => s.session_type !== "rest").length;
  const progressPercent = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  const upcomingWeeks = weekData.filter((w) =>
    w.sessions.some((s) => !isBefore(parseISO(s.date), today))
  );
  const pastWeeks = weekData.filter((w) =>
    w.sessions.every((s) => isBefore(parseISO(s.date), today))
  );

  return (
    <div className="space-y-4">
      {/* Plan summary card */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-bold text-base">{plan.name}</h2>
            {plan.goal && <p className="text-xs text-muted-foreground mt-0.5">{plan.goal}</p>}
          </div>
          <span className="text-xs bg-secondary px-2 py-1 rounded-lg capitalize text-muted-foreground">
            {plan.sport}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedSessions} of {totalSessions} sessions complete</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Start: {formatDate(plan.start_date, "MMM d")}</span>
          <span>End: {formatDate(plan.end_date, "MMM d")}</span>
          <span>{plan.total_weeks} weeks</span>
        </div>
      </div>

      {/* Week tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All Weeks</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <div className="space-y-6">
            {upcomingWeeks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No upcoming sessions
              </p>
            ) : (
              upcomingWeeks.map((week) => (
                <WeekView
                  key={week.weekNumber}
                  week={week}
                  onToggleComplete={onToggleComplete}
                  onUpdate={onUpdate}
                  isCurrentWeek={week.weekNumber === currentWeekNumber}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="all">
          <div className="space-y-6">
            {weekData.map((week) => (
              <WeekView
                key={week.weekNumber}
                week={week}
                onToggleComplete={onToggleComplete}
                onUpdate={onUpdate}
                isCurrentWeek={week.weekNumber === currentWeekNumber}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="past">
          <div className="space-y-6">
            {pastWeeks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No past sessions yet
              </p>
            ) : (
              [...pastWeeks].reverse().map((week) => (
                <WeekView
                  key={week.weekNumber}
                  week={week}
                  onToggleComplete={onToggleComplete}
                  onUpdate={onUpdate}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
