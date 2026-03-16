export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { LogOut, Calendar, User } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/profile/SignOutButton";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: calendarTokens } = await supabase
    .from("google_calendar_tokens")
    .select("id, calendar_id, updated_at")
    .eq("user_id", user.id)
    .single();

  const { data: plansCount } = await supabase
    .from("training_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="flex flex-col">
      <Header title="Profile" />

      <div className="flex flex-col gap-4 px-4 py-6">
        {/* User card */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
            {profile?.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div>
            <p className="font-bold text-base">{profile?.name ?? "Athlete"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Member since {formatDate(user.created_at, "MMM yyyy")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-3">Your Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{(plansCount as unknown as { count: number })?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Training Plans</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-accent">∞</p>
              <p className="text-xs text-muted-foreground mt-0.5">AI Sessions</p>
            </div>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Calendar size={16} />
            Google Calendar
          </h3>
          {calendarTokens ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-400 font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">
                  Last synced: {formatDate(calendarTokens.updated_at)}
                </p>
              </div>
              <Link href="/api/calendar/connect">
                <Button variant="outline" size="sm">Reconnect</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Not connected</p>
              <Link href="/api/calendar/connect">
                <Button variant="outline" size="sm">Connect</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Sign out */}
        <SignOutButton />
      </div>
    </div>
  );
}
