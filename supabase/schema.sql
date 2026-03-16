-- ============================================================
-- EnduranceAI Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ============================================================
-- USER SPORT PROFILES
-- ============================================================
create table public.user_sport_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  sport text not null check (sport in ('marathon', 'triathlon', 'hyrox')),
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  current_weekly_volume_km float,
  goal_event text,
  goal_date date,
  goal_time text,
  available_days jsonb default '[]'::jsonb,
  max_session_duration int default 90,
  injuries_constraints text,
  equipment_available text,
  additional_context text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_sport_profiles enable row level security;
create policy "Users can manage own sport profiles" on public.user_sport_profiles
  for all using (auth.uid() = user_id);

-- ============================================================
-- TRAINING PLANS
-- ============================================================
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  sport_profile_id uuid references public.user_sport_profiles(id) on delete set null,
  name text not null,
  sport text not null check (sport in ('marathon', 'triathlon', 'hyrox')),
  start_date date not null,
  end_date date not null,
  goal text,
  status text default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  total_weeks int not null default 12,
  ai_model_used text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_training_plans_user_id on public.training_plans(user_id);
create index idx_training_plans_status on public.training_plans(status);

alter table public.training_plans enable row level security;
create policy "Users can manage own training plans" on public.training_plans
  for all using (auth.uid() = user_id);

-- ============================================================
-- TRAINING SESSIONS
-- ============================================================
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.training_plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  week_number int not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  session_type text not null check (session_type in (
    'run', 'bike', 'swim', 'strength', 'brick', 'hyrox', 'functional', 'rest', 'cross-training'
  )),
  title text not null,
  description text,
  duration_minutes int,
  distance float,
  distance_unit text default 'km' check (distance_unit in ('km', 'mi')),
  intensity text check (intensity in ('recovery', 'easy', 'moderate', 'hard', 'race-pace')),
  heart_rate_zone text,
  pace_target text,
  notes text,
  google_calendar_event_id text,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_training_sessions_plan_id on public.training_sessions(plan_id);
create index idx_training_sessions_user_id on public.training_sessions(user_id);
create index idx_training_sessions_date on public.training_sessions(date);

alter table public.training_sessions enable row level security;
create policy "Users can manage own sessions" on public.training_sessions
  for all using (auth.uid() = user_id);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_id uuid references public.training_plans(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_chat_messages_user_id on public.chat_messages(user_id);
create index idx_chat_messages_plan_id on public.chat_messages(plan_id);
create index idx_chat_messages_created_at on public.chat_messages(created_at desc);

alter table public.chat_messages enable row level security;
create policy "Users can manage own messages" on public.chat_messages
  for all using (auth.uid() = user_id);

-- ============================================================
-- GOOGLE CALENDAR TOKENS
-- ============================================================
create table public.google_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text default 'primary',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.google_calendar_tokens enable row level security;
create policy "Users can manage own calendar tokens" on public.google_calendar_tokens
  for all using (auth.uid() = user_id);
