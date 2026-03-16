"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn, DAYS_OF_WEEK, SPORTS_CONFIG, formatDate } from "@/lib/utils";
import type { OnboardingAnswers, Sport, ExperienceLevel } from "@/types";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { differenceInCalendarDays, addDays } from "date-fns";

interface QuestionnaireFormProps {
  onSubmit: (answers: OnboardingAnswers) => void;
  loading?: boolean;
}

const DEFAULT_ANSWERS: OnboardingAnswers = {
  sport: "marathon",
  experience_level: "intermediate",
  goal_event: "",
  goal_date: "",
  goal_time: "",
  current_weekly_volume_km: 0,
  available_days: ["Monday", "Wednesday", "Friday", "Saturday"],
  max_session_duration: 90,
  injuries_constraints: "",
  equipment_available: "",
  additional_context: "",
  plan_duration_weeks: 12,
};

function getValidPlanWeeks(goalDate: string): number[] {
  const all = [8, 12, 16, 20];
  if (!goalDate) return all;
  const daysToRace = differenceInCalendarDays(new Date(goalDate), new Date());
  const weeksToRace = Math.floor(daysToRace / 7);
  const valid = all.filter((w) => w <= weeksToRace);
  return valid.length > 0 ? valid : [];
}

export function QuestionnaireForm({ onSubmit, loading }: QuestionnaireFormProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ANSWERS);

  const update = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: string) => {
    setAnswers((prev) => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day],
    }));
  };

  const steps = [
    // Step 0: Sport selection
    {
      title: "What's your sport?",
      subtitle: "Choose the sport you want to train for",
      content: (
        <div className="grid grid-cols-1 gap-3">
          {(Object.entries(SPORTS_CONFIG) as [Sport, typeof SPORTS_CONFIG.marathon][]).map(
            ([key, sport]) => (
              <button
                key={key}
                onClick={() => update("sport", key)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all",
                  answers.sport === key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-border/80"
                )}
              >
                <span className="text-3xl">{sport.emoji}</span>
                <div>
                  <p className="font-semibold">{sport.label}</p>
                  <p className="text-xs text-muted-foreground">{sport.description}</p>
                </div>
              </button>
            )
          )}
        </div>
      ),
    },
    // Step 1: Experience & Goal
    {
      title: "Your experience",
      subtitle: "Help us calibrate the right training load",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Experience level</label>
            <div className="grid grid-cols-2 gap-2">
              {(["beginner", "intermediate", "advanced", "elite"] as ExperienceLevel[]).map(
                (level) => (
                  <button
                    key={level}
                    onClick={() => update("experience_level", level)}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-sm font-medium capitalize transition-all",
                      answers.experience_level === level
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {level}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Goal event (optional)</label>
            <Input
              placeholder={
                answers.sport === "marathon"
                  ? "e.g. Berlin Marathon 2025"
                  : answers.sport === "triathlon"
                  ? "e.g. Ironman 70.3 Barcelona"
                  : "e.g. HYROX Munich"
              }
              value={answers.goal_event}
              onChange={(e) => update("goal_event", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Race date (optional)</label>
            <Input
              type="date"
              value={answers.goal_date}
              onChange={(e) => {
                const newDate = e.target.value;
                update("goal_date", newDate);
                // Auto-correct plan duration if it exceeds weeks to race
                if (newDate) {
                  const valid = getValidPlanWeeks(newDate);
                  if (valid.length > 0 && !valid.includes(answers.plan_duration_weeks)) {
                    update("plan_duration_weeks", valid[valid.length - 1]);
                  }
                }
              }}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Goal time / finish target (optional)</label>
            <Input
              placeholder={
                answers.sport === "marathon"
                  ? "e.g. Sub 4:00:00 or BQ"
                  : answers.sport === "triathlon"
                  ? "e.g. Under 6 hours"
                  : "e.g. Under 1:30 or podium"
              }
              value={answers.goal_time}
              onChange={(e) => update("goal_time", e.target.value)}
            />
          </div>
        </div>
      ),
    },
    // Step 2: Current fitness
    {
      title: "Your current fitness",
      subtitle: "We'll build from where you are",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Current weekly training volume (km)
            </label>
            <p className="text-xs text-muted-foreground">
              {answers.sport === "triathlon"
                ? "Combined run + swim + bike (bike ÷ 3 as equivalent)"
                : "Your average running or training km per week"}
            </p>
            <Input
              type="number"
              placeholder="e.g. 40"
              value={answers.current_weekly_volume_km || ""}
              onChange={(e) =>
                update("current_weekly_volume_km", parseFloat(e.target.value) || 0)
              }
              min="0"
              max="300"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Plan duration (weeks)
            </label>
            {(() => {
              const validWeeks = getValidPlanWeeks(answers.goal_date);
              const allWeeks = [8, 12, 16, 20];
              if (answers.goal_date && validWeeks.length === 0) {
                return (
                  <p className="text-xs text-destructive">
                    Race is less than 8 weeks away — consider a different goal date or shorter prep.
                  </p>
                );
              }
              const planStart = answers.goal_date && answers.plan_duration_weeks
                ? addDays(new Date(answers.goal_date), -(answers.plan_duration_weeks * 7))
                : null;
              const startIsInPast = planStart && planStart < new Date();
              return (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {allWeeks.map((w) => {
                      const disabled = answers.goal_date ? !validWeeks.includes(w) : false;
                      return (
                        <button
                          key={w}
                          onClick={() => !disabled && update("plan_duration_weeks", w)}
                          disabled={disabled}
                          className={cn(
                            "py-3 rounded-xl border text-sm font-medium transition-all",
                            answers.plan_duration_weeks === w
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground",
                            disabled && "opacity-30 cursor-not-allowed"
                          )}
                        >
                          {w}w
                        </button>
                      );
                    })}
                  </div>
                  {planStart && !startIsInPast && (
                    <p className="text-xs text-muted-foreground">
                      Plan starts {formatDate(planStart.toISOString().split("T")[0], "MMM d")} — {answers.plan_duration_weeks} weeks before race
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ),
    },
    // Step 3: Schedule
    {
      title: "Your schedule",
      subtitle: "We'll train around your life",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Available training days</label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "py-2.5 rounded-xl border text-xs font-medium transition-all",
                    answers.available_days.includes(day)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {answers.available_days.length} days selected
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max session duration (minutes)</label>
            <div className="grid grid-cols-4 gap-2">
              {[60, 90, 120, 180].map((mins) => (
                <button
                  key={mins}
                  onClick={() => update("max_session_duration", mins)}
                  className={cn(
                    "py-3 rounded-xl border text-sm font-medium transition-all",
                    answers.max_session_duration === mins
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  {mins === 60 ? "" : mins === 90 ? "30" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    // Step 4: Constraints & context
    {
      title: "Any constraints?",
      subtitle: "The more we know, the better your plan",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Injuries or health constraints
            </label>
            <Textarea
              placeholder="e.g. Mild knee pain, avoiding high-impact work for 2 weeks..."
              value={answers.injuries_constraints}
              onChange={(e) => update("injuries_constraints", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Available equipment</label>
            <Textarea
              placeholder="e.g. Home treadmill, gym access, outdoor track, no pool..."
              value={answers.equipment_available}
              onChange={(e) => update("equipment_available", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Anything else you want your coach to know?
            </label>
            <Textarea
              placeholder="e.g. I travel 2 weeks in month 2, I'm a morning runner, I've done 3 marathons before..."
              value={answers.additional_context}
              onChange={(e) => update("additional_context", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      ),
    },
  ];

  const totalSteps = steps.length;
  const currentStep = steps[step];
  const isLastStep = step === totalSteps - 1;

  const canProceed = () => {
    if (step === 0) return !!answers.sport;
    if (step === 1) return !!answers.experience_level;
    if (step === 3) return answers.available_days.length > 0;
    return true;
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Progress */}
      <div className="px-4 pt-4 pb-2 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
        </div>
        <Progress value={step + 1} max={totalSteps} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1 mb-5">
          <h2 className="text-xl font-bold">{currentStep.title}</h2>
          <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
        </div>
        {currentStep.content}
      </div>

      {/* Navigation */}
      <div className="px-4 pb-4 pt-2 flex gap-3 border-t border-border safe-bottom">
        {step > 0 && (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1"
          >
            <ChevronLeft size={18} />
            Back
          </Button>
        )}
        <Button
          onClick={() => {
            if (isLastStep) {
              onSubmit(answers);
            } else {
              setStep((s) => s + 1);
            }
          }}
          disabled={!canProceed() || loading}
          loading={loading && isLastStep}
          className="flex-1"
        >
          {isLastStep ? "Generate My Plan ✨" : "Continue"}
          {!isLastStep && <ChevronRight size={18} />}
        </Button>
      </div>
    </div>
  );
}
