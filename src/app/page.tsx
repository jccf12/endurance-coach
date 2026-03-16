export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Hero */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-16 text-center">
        {/* Logo / Brand */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 text-4xl mb-4">
            🏅
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Endurance<span className="text-primary">AI</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Your AI endurance coach
          </p>
        </div>

        {/* Sport icons */}
        <div className="flex gap-4 mb-10 text-3xl">
          <span title="Marathon">🏃</span>
          <span title="Triathlon">🚴</span>
          <span title="HYROX">⚡</span>
        </div>

        {/* Value props */}
        <div className="space-y-3 mb-10 max-w-xs w-full">
          {[
            { icon: "🎯", text: "Personalized training plans" },
            { icon: "💬", text: "AI coach chat, anytime" },
            { icon: "📅", text: "Google Calendar sync" },
            { icon: "🔄", text: "Modify plans on the fly" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 text-left"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/login?mode=signup">
            <Button size="xl" className="w-full">
              Get Started Free
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="xl" className="w-full">
              Sign In
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Built for serious endurance athletes
        </p>
      </div>
    </main>
  );
}
