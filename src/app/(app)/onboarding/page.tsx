"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionnaireForm } from "@/components/onboarding/QuestionnaireForm";
import { useToast } from "@/components/ui/toast";
import type { OnboardingAnswers } from "@/types";

type Step = "questionnaire" | "submitting";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("questionnaire");
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (answers: OnboardingAnswers) => {
    setStep("submitting");

    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      const data = await res.json() as { planId?: string; error?: string };

      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? "Failed to create plan");
      }

      router.push(`/plan/${data.planId}`);
    } catch (err: unknown) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setStep("questionnaire");
    }
  };

  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Setting up your plan…</p>
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
