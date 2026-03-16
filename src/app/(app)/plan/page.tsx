export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate, SPORTS_CONFIG } from "@/lib/utils";
import type { TrainingPlan } from "@/types";
import { Plus, ChevronRight } from "lucide-react";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plans } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const allPlans = (plans ?? []) as TrainingPlan[];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold">Training Plans</h1>
          <p className="text-xs text-muted-foreground">{allPlans.length} plan{allPlans.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/onboarding">
          <Button size="sm" className="gap-1.5">
            <Plus size={16} />
            New
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {allPlans.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 gap-4">
            <div className="text-5xl">📋</div>
            <div>
              <h2 className="font-bold text-lg mb-1">No plans yet</h2>
              <p className="text-sm text-muted-foreground">
                Create your first AI training plan to get started.
              </p>
            </div>
            <Link href="/onboarding">
              <Button>Create My First Plan</Button>
            </Link>
          </div>
        ) : (
          allPlans.map((plan) => {
            const sport = SPORTS_CONFIG[plan.sport];
            return (
              <Link key={plan.id} href={`/plan/${plan.id}`}>
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="text-2xl w-12 h-12 flex items-center justify-center bg-secondary rounded-xl shrink-0">
                    {sport?.emoji ?? "🏅"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(plan.start_date, "MMM d")} – {formatDate(plan.end_date, "MMM d")}
                      {" · "}{plan.total_weeks}w
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs capitalize px-2 py-0.5 rounded-full ${
                          plan.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : plan.status === "completed"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {plan.status}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{sport?.label}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
