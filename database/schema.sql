-- Zhiheng v1: authenticated, user-owned data. Apply to a dedicated Supabase project.
-- Existing browser data is imported separately; this script never reads or deletes it.

create table public.conversations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id)
);

create table public.messages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  position integer not null check (position >= 0),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null,
  unique (user_id, conversation_id, position),
  foreign key (user_id, conversation_id) references public.conversations(user_id, id) on delete cascade
);

create table public.profile_insights (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  dimension text not null check (dimension in (
    'personality', 'cognitive_architecture', 'values_and_beliefs',
    'behavioral_patterns', 'knowledge_structure', 'social_relations', 'narrative_self'
  )),
  statement text not null check (char_length(statement) between 1 and 500),
  origin text not null check (origin in ('user_statement', 'ai_inference')),
  status text not null check (status in ('candidate', 'confirmed', 'rejected')),
  unique (user_id, id),
  unique (user_id, sort_order)
);

create table public.insight_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insight_id uuid not null,
  conversation_id uuid not null,
  message_id uuid not null,
  excerpt text not null check (char_length(excerpt) between 1 and 500),
  foreign key (user_id, insight_id) references public.profile_insights(user_id, id) on delete cascade
);
-- Conversation and message references remain even if their source is deleted.
-- The application then marks the insight's evidence as invalid, as the local prototype does.

create table public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dimension text not null check (dimension in (
    'personality', 'cognitive_architecture', 'values_and_beliefs',
    'behavioral_patterns', 'knowledge_structure', 'social_relations', 'narrative_self'
  )),
  intention text not null check (char_length(intention) between 1 and 500),
  -- Optional user self-report. Null means not set; this is not a measured score.
  willingness text check (willingness in ('not_now', 'slight', 'moderate', 'strong', 'highest')),
  status text not null check (status in ('active', 'paused')),
  unique (user_id, dimension)
);

create table public.outcomes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null,
  dimension text not null check (dimension in (
    'personality', 'cognitive_architecture', 'values_and_beliefs',
    'behavioral_patterns', 'knowledge_structure', 'social_relations', 'narrative_self'
  )),
  goal_intention text not null check (char_length(goal_intention) between 1 and 500),
  action text not null check (char_length(action) between 1 and 500),
  result text not null check (char_length(result) between 1 and 1000),
  rating text not null check (rating in ('toward', 'unclear', 'away')),
  created_at timestamptz not null
);
-- goal_id is intentionally a snapshot reference: deleting or editing a goal keeps history.

create table public.assessment_labels (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insight_id uuid not null,
  label text not null check (label in ('strength', 'growth')),
  primary key (user_id, insight_id),
  foreign key (user_id, insight_id) references public.profile_insights(user_id, id) on delete cascade
);

create table public.tension_notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_insight_id uuid not null,
  second_insight_id uuid not null,
  note text not null check (char_length(note) between 1 and 500),
  created_at timestamptz not null,
  check (first_insight_id <> second_insight_id),
  foreign key (user_id, first_insight_id) references public.profile_insights(user_id, id) on delete cascade,
  foreign key (user_id, second_insight_id) references public.profile_insights(user_id, id) on delete cascade
);

create table public.auto_profile_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  checkpoints jsonb not null default '{}'::jsonb check (jsonb_typeof(checkpoints) = 'object'),
  updated_at timestamptz not null default now()
);

-- Explicit user-triggered browser backup. The normalized tables above are the
-- future live data model; this single row makes first migration reversible.
create table public.user_snapshots (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  version integer not null default 1 check (version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 5000000),
  updated_at timestamptz not null default now()
);

create index conversations_owner_updated_idx on public.conversations (user_id, updated_at desc);
create index messages_owner_conversation_idx on public.messages (user_id, conversation_id, position);
create index profile_insights_owner_order_idx on public.profile_insights (user_id, sort_order);
create index insight_evidence_owner_insight_idx on public.insight_evidence (user_id, insight_id);
create index outcomes_owner_created_idx on public.outcomes (user_id, created_at desc);
create index tension_notes_owner_created_idx on public.tension_notes (user_id, created_at desc);
create index tension_notes_first_insight_idx on public.tension_notes (user_id, first_insight_id);
create index tension_notes_second_insight_idx on public.tension_notes (user_id, second_insight_id);

-- Grants and RLS are both required. No signed-out visitor receives table access.
revoke all on public.conversations, public.messages, public.profile_insights,
  public.insight_evidence, public.goals, public.outcomes, public.assessment_labels,
  public.tension_notes, public.auto_profile_settings, public.user_snapshots from anon, authenticated;
grant select, insert, update, delete on public.conversations, public.messages,
  public.profile_insights, public.insight_evidence, public.goals, public.outcomes,
  public.assessment_labels, public.tension_notes, public.auto_profile_settings,
  public.user_snapshots to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.profile_insights enable row level security;
alter table public.insight_evidence enable row level security;
alter table public.goals enable row level security;
alter table public.outcomes enable row level security;
alter table public.assessment_labels enable row level security;
alter table public.tension_notes enable row level security;
alter table public.auto_profile_settings enable row level security;
alter table public.user_snapshots enable row level security;

create policy conversations_select on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy conversations_insert on public.conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy conversations_update on public.conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy conversations_delete on public.conversations for delete to authenticated using ((select auth.uid()) = user_id);

create policy messages_select on public.messages for select to authenticated using ((select auth.uid()) = user_id);
create policy messages_insert on public.messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy messages_update on public.messages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy messages_delete on public.messages for delete to authenticated using ((select auth.uid()) = user_id);

create policy profile_insights_select on public.profile_insights for select to authenticated using ((select auth.uid()) = user_id);
create policy profile_insights_insert on public.profile_insights for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profile_insights_update on public.profile_insights for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profile_insights_delete on public.profile_insights for delete to authenticated using ((select auth.uid()) = user_id);

create policy insight_evidence_select on public.insight_evidence for select to authenticated using ((select auth.uid()) = user_id);
create policy insight_evidence_insert on public.insight_evidence for insert to authenticated with check ((select auth.uid()) = user_id);
create policy insight_evidence_update on public.insight_evidence for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy insight_evidence_delete on public.insight_evidence for delete to authenticated using ((select auth.uid()) = user_id);

create policy goals_select on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy outcomes_select on public.outcomes for select to authenticated using ((select auth.uid()) = user_id);
create policy outcomes_insert on public.outcomes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy outcomes_update on public.outcomes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy outcomes_delete on public.outcomes for delete to authenticated using ((select auth.uid()) = user_id);

create policy assessment_labels_select on public.assessment_labels for select to authenticated using ((select auth.uid()) = user_id);
create policy assessment_labels_insert on public.assessment_labels for insert to authenticated with check ((select auth.uid()) = user_id);
create policy assessment_labels_update on public.assessment_labels for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy assessment_labels_delete on public.assessment_labels for delete to authenticated using ((select auth.uid()) = user_id);

create policy tension_notes_select on public.tension_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy tension_notes_insert on public.tension_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tension_notes_update on public.tension_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tension_notes_delete on public.tension_notes for delete to authenticated using ((select auth.uid()) = user_id);

create policy auto_profile_settings_select on public.auto_profile_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy auto_profile_settings_insert on public.auto_profile_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy auto_profile_settings_update on public.auto_profile_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy auto_profile_settings_delete on public.auto_profile_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_snapshots_select on public.user_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy user_snapshots_insert on public.user_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_snapshots_update on public.user_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_snapshots_delete on public.user_snapshots for delete to authenticated using ((select auth.uid()) = user_id);
