-- Focus & context (editable, feeds every plan + chat)
alter table profiles
  add column if not exists focus_areas jsonb not null default '[]'::jsonb,
  add column if not exists recent_context text,
  add column if not exists season_status text;

-- Persistent coach conversation
create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'coach')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_time on coach_messages (user_id, created_at);

alter table coach_messages enable row level security;
create policy "coach_messages_all_own" on coach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
