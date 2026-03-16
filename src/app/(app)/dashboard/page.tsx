export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/training/SessionCard";
import { formatDate, SPORTS_CONFIG } from "@/lib/utils";
import type { TrainingPlan, TrainingSession } from "@/types";
import { Plus, ChevronRight, Calendar, MessageCircle } from "lucide-react";
import { parseISO, isToday, isTomorrow, addDays, startOfDay } from "date-fns";

async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const today = startOfDay(new Date()).toISOString().split("T")[0];
  const weekAhead = addDays(new Date(), 7).toISOString().split("T")[0];

  // Get active plans
  const { data: plans } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);

  // Get upcoming sessions (next 7 days)
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("date", today)
    .lte("date", weekAhead)
    .order("date")
    .limit(10);

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return { plans: plans ?? [], sessions: sessions ?? [], profile };
}

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return formatDate(dateStr, "EEE, MMM d");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { plans, sessions, profile } = await getDashboardData(user.id);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const upcomingSessions = sessions.filter((s) => s.date > todayStr);

  const hasActivePlan = plans.length > 0;
  const activePlan = plans[0] as TrainingPlan | undefined;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile?.name?.split(" ")[0] ?? "Athlete";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-border">
        <p className="text-muted-foreground text-sm">{greeting()},</p>
        <h1 className="text-2xl font-bold">{firstName} 👋</h1>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {!hasActivePlan ? (
          /* Empty state */
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="text-6xl">🏅</div>
            <div>
              <h2 className="text-xl font-bold mb-1">Ready to train?</h2>
              <p className="text-muted-foreground text-sm">
                Create your first AI-powered training plan and start crushing your goals.
              </p>
            </div>
            <Link href="/onboarding">
              <Button size="lg" className="gap-2">
                <Plus size={20} />
                Create Training Plan
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Active plan card */}
            <Link href={`/plan/${activePlan!.id}`}>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wide">
                      Active Plan
                    </p>
                    <h2 className="font-bold text-base mt-0.5">{activePlan!.name}</h2>
                  </div>
                  <span className="text-2xl">
                    {SPORTS_CONFIG[activePlan!.sport]?.emoji ?? "🏅"}
                  </span>
                </div>
                {activePlan!.goal && (
                  <p className="text-sm text-muted-foreground mb-3">{activePlan!.goal}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatDate(activePlan!.start_date, "MMM d")} –{" "}
                    {formatDate(activePlan!.end_date, "MMM d")}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    View plan <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </Link>

            {/* Today's sessions */}
            {todaySessions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  Today
                </h3>
                {(todaySessions as TrainingSession[]).map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}

            {/* Upcoming */}
            {upcomingSessions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Upcoming</h3>
                {(upcomingSessions as TrainingSession[]).slice(0, 4).map((session) => (
                  <div key={session.id} className="space-y-1">
                    <p className="text-xs text-muted-foreground px-1">
                      {getDateLabel(session.date)}
                    </p>
                    <SessionCard session={session} compact />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Link href="/chat">
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
              <MessageCircle size={24} className="text-primary" />
              <p className="font-semibold text-sm">Ask Coach</p>
              <p className="text-xs text-muted-foreground">Get advice, modify your plan</p>
            </div>
          </Link>
          <Link href="/onboarding">
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
              <Plus size={24} className="text-accent" />
              <p className="font-semibold text-sm">New Plan</p>
              <p className="text-xs text-muted-foreground">Create another training plan</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
