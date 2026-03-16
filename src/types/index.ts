export type Sport = "marathon" | "triathlon" | "hyrox";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "elite";
export type SessionType =
  | "run"
  | "bike"
  | "swim"
  | "strength"
  | "brick"
  | "hyrox"
  | "functional"
  | "rest"
  | "cross-training";
export type Intensity = "recovery" | "easy" | "moderate" | "hard" | "race-pace";
export type PlanStatus = "draft" | "active" | "completed" | "archived";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserSportProfile {
  id: string;
  user_id: string;
  sport: Sport;
  experience_level: ExperienceLevel;
  current_weekly_volume_km: number | null;
  goal_event: string | null;
  goal_date: string | null;
  goal_time: string | null;
  available_days: string[];
  max_session_duration: number | null;
  injuries_constraints: string | null;
  equipment_available: string | null;
  additional_context: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlan {
  id: string;
  user_id: string;
  sport_profile_id: string | null;
  name: string;
  sport: Sport;
  start_date: string;
  end_date: string;
  goal: string | null;
  status: PlanStatus;
  total_weeks: number;
  ai_model_used: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  sessions?: TrainingSession[];
}

export interface TrainingSession {
  id: string;
  plan_id: string;
  user_id: string;
  date: string;
  week_number: number;
  day_of_week: number;
  session_type: SessionType;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  distance: number | null;
  distance_unit: "km" | "mi";
  intensity: Intensity | null;
  heart_rate_zone: string | null;
  pace_target: string | null;
  notes: string | null;
  google_calendar_event_id: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  plan_id: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GoogleCalendarTokens {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

// Onboarding questionnaire shape
export interface OnboardingAnswers {
  sport: Sport;
  experience_level: ExperienceLevel;
  goal_event: string;
  goal_date: string;
  goal_time: string;
  current_weekly_volume_km: number;
  available_days: string[];
  max_session_duration: number;
  injuries_constraints: string;
  equipment_available: string;
  additional_context: string;
  plan_duration_weeks: number;
}

// AI request/response types
export interface GeneratePlanRequest {
  profile: OnboardingAnswers;
  provider?: "anthropic" | "openai";
}

export interface ChatRequest {
  message: string;
  planId?: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: "anthropic" | "openai";
}

export interface PlanModification {
  type: "reschedule" | "replace" | "add" | "remove" | "adjust";
  sessionId?: string;
  changes: Partial<TrainingSession>;
  reason: string;
}

// Week view helpers
export interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
  sessions: TrainingSession[];
  totalVolume: number;
  totalDuration: number;
}
