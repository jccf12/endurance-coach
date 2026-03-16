# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (uses Turbopack)
npm run build    # Production build
npm run lint     # ESLint check
./node_modules/.bin/tsc --noEmit  # Type-check without building (npm tsc won't work — use the local binary)
```

There are no tests. The app requires env vars (see `.env.local`) to run; the Supabase client falls back to placeholder values so it won't crash on import, but API routes will fail without real credentials.

## Architecture

### Stack
Next.js 16 App Router · React 19 · TypeScript · TailwindCSS 4 · Supabase (auth + Postgres) · Anthropic Claude API · Google Calendar API

### Route structure
- `src/app/(app)/` — all authenticated pages, wrapped by a layout that enforces auth via middleware
- `src/app/api/` — API routes:
  - `ai/chat` — SSE streaming chat with tool use
  - `plans/generate` — SSE streaming plan generation
  - `plans/apply-proposal` — applies a coach-proposed batch of session changes
  - `plans/[id]` — plan CRUD
  - `sessions/[id]` — session CRUD
  - `calendar/{connect,callback,sync}` — Google Calendar OAuth + sync

### AI layer (`src/lib/ai/`)
- `providers/anthropic.ts` — Anthropic client; `CHAT_MODEL = claude-haiku-4-5-20251001` (cheap), `PLAN_MODEL = claude-sonnet-4-6` (quality). All plan generation uses internal streaming (`messages.stream`) with `max_tokens: 16000`.
- `providers/openai.ts` — fallback provider, selected via `NEXT_PUBLIC_AI_PROVIDER` env var
- `coach-tools.ts` — Claude tool definitions (`modify_session`, `add_session`, `remove_session`, `propose_changes`) + execution functions that write to Supabase and sync Google Calendar. `applyProposedChanges()` is the batch-apply path used by `/api/plans/apply-proposal`.
- `index.ts` — `generateTrainingPlan()` (non-streaming wrapper, accepts `onChunk` callback), `streamCoachingChatWithTools()` (two-step tool-use loop: stream → execute tools → stream again), `buildPlanContext()` (serialises up to 28 upcoming sessions with DB IDs into the system prompt).
- `prompts/system.ts` — `COACHING_SYSTEM_PROMPT` includes rules for when to call `propose_changes` vs direct tools (single change → apply directly; 2+ sessions → propose first).

### Coach tool-use flow
1. Chat API sends the user message to Claude **with all four tools** and `tool_choice: "auto"`.
2. If Claude emits only text → stream it and done.
3. If Claude calls tools → execute each via `executeCoachTool()` (DB write + optional calendar sync), emit `plan_updated` or `plan_proposal` SSE events, then make a second streaming request with the tool results so Claude can give a natural-language follow-up.
4. Frontend (`src/app/(app)/chat/page.tsx`) handles `plan_updated` (shows toast + "view plan" banner) and `plan_proposal` (renders a confirmation card with Apply/Dismiss).

### Plan generation flow
1. Onboarding page POSTs to `/api/plans/generate` and reads the SSE stream.
2. The route calls `generateTrainingPlan()` with an `onChunk` callback that sends heartbeat events every ~2000 chars so the connection stays alive.
3. After AI finishes, the route inserts into `training_plans` + batched `training_sessions` (50 per insert), then sends `{ status: "done", planId }`.

### Database (Supabase)
Schema lives in `supabase/schema.sql`. All tables have RLS — every query needs the server-side Supabase client (`src/lib/supabase/server.ts`) which reads the session cookie. Client-side queries use `src/lib/supabase/client.ts`.

Key tables: `profiles`, `user_sport_profiles`, `training_plans`, `training_sessions` (has `google_calendar_event_id` for calendar sync tracking), `chat_messages`, `google_calendar_tokens`.

### Google Calendar (`src/lib/google-calendar/index.ts`)
OAuth tokens are stored per-user in `google_calendar_tokens`. Functions: `createCalendarEvents` (bulk sync), `createSingleCalendarEvent` (returns event ID), `updateCalendarEvent`, `deleteCalendarEvent`. Calendar ops inside `executeCoachTool` are non-fatal — a calendar failure won't roll back the DB change.

### Auth
Supabase Auth with Google OAuth. `src/middleware.ts` runs `updateSession` on every request to refresh the cookie. The `(app)` layout redirects to `/login` if no session.
