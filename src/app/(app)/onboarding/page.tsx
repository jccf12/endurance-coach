"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionnaireForm } from "@/components/onboarding/QuestionnaireForm";
import { useToast } from "@/components/ui/toast";
import type { OnboardingAnswers } from "@/types";

type Step = "questionnaire" | "generating" | "done";

const PROGRESS_MESSAGES = [
  "Analyzing your fitness profile…",
  "Designing your training blocks…",
  "Building week-by-week sessions…",
  "Optimizing for your race date…",
  "Adding recovery and taper weeks…",
  "Finalizing your plan…",
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("questionnaire");
  const [planId, setPlanId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState(PROGRESS_MESSAGES[0]);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (answers: OnboardingAnswers) => {
    setStep("generating");
    setProgressMsg(PROGRESS_MESSAGES[0]);

    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let msgIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as {
              status?: string;
              progress?: number;
              error?: string;
              planId?: string;
            };

            if (parsed.error) throw new Error(parsed.error);

            if (parsed.status === "generating" && parsed.progress !== undefined) {
              // Rotate through messages as chars accumulate
              const newIndex = Math.min(
                Math.floor(parsed.progress / 3000),
                PROGRESS_MESSAGES.length - 1
              );
              if (newIndex > msgIndex) {
                msgIndex = newIndex;
                setProgressMsg(PROGRESS_MESSAGES[msgIndex]);
              }
            } else if (parsed.status === "saving") {
              setProgressMsg("Saving your plan to the database…");
            } else if (parsed.status === "done" && parsed.planId) {
              setPlanId(parsed.planId);
              setStep("done");
            }
          } catch (err) {
            if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
              throw err;
            }
          }
        }
      }
    } catch (err: unknown) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setStep("questionnaire");
    }
  };

  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
        <div className="text-6xl animate-bounce">🏅</div>
        <div>
          <h2 className="text-xl font-bold mb-2">Building your plan…</h2>
          <p className="text-muted-foreground text-sm transition-all duration-500">{progressMsg}</p>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (step === "done" && planId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
        <div className="text-6xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Your plan is ready!</h2>
          <p className="text-muted-foreground text-sm">
            Your personalized training plan has been created. Let's get to work!
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push(`/plan/${planId}`)}
            className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm active:scale-95 transition-all"
          >
            View My Plan
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full h-12 border border-border rounded-2xl font-semibold text-sm text-muted-foreground active:scale-95 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <h1 className="font-bold text-base">Create Training Plan</h1>
        <p className="text-xs text-muted-foreground">Powered by AI coaching</p>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <QuestionnaireForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
