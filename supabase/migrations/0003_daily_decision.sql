alter table daily_checkins
  add column if not exists decision text,
  add column if not exists decision_rationale text,
  add column if not exists adjusted_session jsonb,
  add column if not exists decision_source text;
