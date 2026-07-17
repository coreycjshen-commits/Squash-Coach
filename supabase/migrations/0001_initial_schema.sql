-- ============ ENUMS ============
create type session_type as enum ('oncourt', 'strength', 'cardio', 'rest');
create type gym_access as enum ('full', 'bodyweight', 'none');
create type playstyle as enum ('attacking', 'retrieving', 'all_court');
create type block_type as enum ('fixed_goal', 'rolling');
create type plan_source as enum ('llm', 'fallback', 'manual');
create type plan_status as enum ('active', 'superseded');
create type solo_focus as enum ('movement', 'fitness', 'touch', 'mixed');
create type adjustment as enum ('keep', 'scale_down', 'scale_up', 'change_modality', 'rest');
create type llm_call_type as enum ('weekly', 'daily');
create type llm_status as enum ('ok', 'fallback', 'error');

-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  playstyle playstyle,
  us_squash_rating numeric(3,1),
  level_descriptor text,
  years_playing numeric(4,1),
  weekly_oncourt_hours numeric(4,1),
  strength_experience text,
  days_per_week int check (days_per_week between 1 and 7),
  avg_session_min int,
  schedule_flexibility text,
  has_partner_default boolean default true,
  gym_access gym_access default 'full',
  goal_type text,
  goal_target_date date,
  injuries jsonb default '[]'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ MACROCYCLES ============
create table macrocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  block_type block_type not null,
  phases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ WEEKLY PLANS ============
create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  macrocycle_id uuid references macrocycles(id) on delete set null,
  week_start date not null,
  phase text,
  rationale text,
  status plan_status not null default 'active',
  generated_by plan_source not null default 'llm',
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ============ SESSIONS (planned) ============
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  day date not null,
  type session_type not null,
  focus text,
  duration_min int,
  target_rpe int check (target_rpe between 1 and 10),
  detail jsonb default '{}'::jsonb,
  solo_focus_tag solo_focus,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ DAILY CHECK-INS ============
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  resting_hr int,
  hrv int,
  sleep_hours numeric(3,1),
  sleep_quality int check (sleep_quality between 1 and 5),
  yesterday_rpe int check (yesterday_rpe between 1 and 10),
  partner_available boolean,
  court_available boolean,
  minutes_available int,
  hrv_delta numeric,
  rhr_delta numeric,
  sleep_delta numeric,
  acwr numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ============ JOURNAL ENTRIES ============
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  checkin_id uuid references daily_checkins(id) on delete set null,
  body text not null default '',
  tags jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index journal_body_fts on journal_entries using gin (to_tsvector('english', body));

-- ============ COMPLETED SESSIONS ============
create table completed_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  date date not null,
  actual_type session_type,
  actual_duration int,
  actual_rpe int check (actual_rpe between 1 and 10),
  adjustment adjustment,
  adjustment_reason text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============ SOLO DRILL LIBRARY (global reference) ============
create table solo_drill_library (
  id uuid primary key default gen_random_uuid(),
  focus solo_focus not null,
  name text not null,
  structure jsonb not null default '{}'::jsonb,
  target_intensity int check (target_intensity between 1 and 10),
  duration_min int,
  equivalent_for session_type not null default 'oncourt'
);

-- ============ LLM LOGS ============
create table llm_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  call_type llm_call_type not null,
  input_summary jsonb,
  raw_response text,
  parsed jsonb,
  status llm_status not null,
  created_at timestamptz not null default now()
);

-- ============ updated_at trigger for profiles ============
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============ auto-create profile row on signup ============
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ ROW LEVEL SECURITY ============
alter table profiles            enable row level security;
alter table macrocycles         enable row level security;
alter table weekly_plans        enable row level security;
alter table sessions            enable row level security;
alter table daily_checkins      enable row level security;
alter table journal_entries     enable row level security;
alter table completed_sessions  enable row level security;
alter table llm_logs            enable row level security;
alter table solo_drill_library  enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

create policy "macrocycles_all_own" on macrocycles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_plans_all_own" on weekly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_all_own" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_checkins_all_own" on daily_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries_all_own" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "completed_sessions_all_own" on completed_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "llm_logs_all_own" on llm_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo_drills_read_all" on solo_drill_library
  for select using (auth.role() = 'authenticated');
