"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TrainingPlanView } from "@/components/training/TrainingPlanView";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrainingPlan, TrainingSession } from "@/types";
import { MessageCircle, Calendar } from "lucide-react";
import Link from "next/link";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  const fetchPlan = useCallback(async () => {
    const { data: planData } = await supabase
      .from("training_plans")
      .select("*")
      .eq("id", id)
      .single();

    const { data: sessionData } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("plan_id", id)
      .order("date");

    if (planData) setPlan(planData as TrainingPlan);
    if (sessionData) setSessions(sessionData as TrainingSession[]);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleToggleComplete = async (sessionId: string, completed: boolean) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, completed, completed_at: completed ? new Date().toISOString() : null }
          : s
      )
    );

    const { error } = await supabase
      .from("training_sessions")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Error", description: "Failed to update session", variant: "destructive" });
      fetchPlan(); // revert
    }
  };

  const handleUpdateSession = async (
    sessionId: string,
    updates: { description?: string | null; duration_minutes?: number | null }
  ) => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      toast({ title: "Error", description: "Failed to save session", variant: "destructive" });
      return;
    }

    const updated = await res.json() as typeof sessions[number];
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch(`/api/calendar/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: id }),
      });

      if (!res.ok) {
        const err = await res.json();
        // If not connected, redirect to connect flow
        if (res.status === 401) {
          router.push(`/api/calendar/connect?planId=${id}`);
          return;
        }
        throw new Error(err.message);
      }

      const data = await res.json();
      toast({
        title: "Calendar synced!",
        description: `${data.created} sessions added to Google Calendar.`,
        variant: "success",
      });
      fetchPlan();
    } catch (err: unknown) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSyncingCalendar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Training Plan" showBack />
        <div className="px-4 py-4 space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Plan not found</p>
        <Button variant="outline" onClick={() => router.push("/plan")}>
          Back to Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title={plan.name}
        subtitle={`${plan.total_weeks} weeks · ${plan.sport}`}
        showBack
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCalendar}
              disabled={syncingCalendar}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
              title="Sync to Google Calendar"
            >
              <Calendar size={18} className={syncingCalendar ? "animate-pulse text-primary" : "text-muted-foreground"} />
            </button>
            <Link href={`/chat?planId=${id}`}>
              <button className="flex items-center justify-center h-9 w-9 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
                <MessageCircle size={18} className="text-muted-foreground" />
              </button>
            </Link>
          </div>
        }
      />
      <div className="px-4 py-4">
        <TrainingPlanView
          plan={plan}
          sessions={sessions}
          onToggleComplete={handleToggleComplete}
          onUpdate={handleUpdateSession}
        />
      </div>
    </div>
  );
}
