-- ============================================================================
-- Case Study Composer — Supabase schema
-- Single coach (you) now; RLS-by-coach from day one so multi-tenant is free later.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- enums ----
do $$ begin
  create type case_mode as enum ('full','abbreviated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type case_status as enum ('intake','extracting','review','rendered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transcript_phase as enum ('early','mid','late');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assessment_status as enum
    ('draft','accepted','edited','grounding_insufficient','manual');
exception when duplicate_object then null; end $$;

-- ---- cases (the container) ----
create table if not exists cases (
  case_id          uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_first_name text,
  client_pseudonym  text,                 -- used in product mode / shared drafts
  case_number       int,
  mode              case_mode  not null default 'full',
  status            case_status not null default 'intake',
  -- engagement facts (intake metadata, fill the Overview table directly)
  program_dates      text,
  session_count      int,
  session_frequency  text,
  session_duration   int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- transcripts (attach one or many, any time) ----
create table if not exists transcripts (
  transcript_id   uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(case_id) on delete cascade,
  session_number  int,
  session_date    date,
  phase           transcript_phase,        -- set by Haiku triage, coach-overridable
  raw_text        text,                    -- or a storage path for large files
  word_count      int,
  uploaded_at     timestamptz not null default now()
);
create index if not exists idx_transcripts_case on transcripts(case_id);

-- ---- assessments (one row per fillable framework field) ----
create table if not exists assessments (
  assessment_id  uuid primary key default gen_random_uuid(),
  case_id        uuid not null references cases(case_id) on delete cascade,
  model          text not null,            -- six_streams | ten_ways | human_domains | epq | narrative_current | ...
  field_key      text not null,            -- matches a key in field_map.json
  value          text,
  rating         text,                     -- NA|C|S, or entering|traversing|exiting; null when n/a
  status         assessment_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (case_id, field_key)              -- idempotent re-extraction: upsert on this
);
create index if not exists idx_assessments_case on assessments(case_id);

-- ---- grounding (transcript evidence backing an assessment) ----
create table if not exists grounding (
  grounding_id   uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references assessments(assessment_id) on delete cascade,
  transcript_id  uuid references transcripts(transcript_id) on delete set null,
  excerpt        text not null,
  timestamp_ref  text,                     -- e.g. 'session 2, 14:30'
  created_at     timestamptz not null default now()
);
create index if not exists idx_grounding_assessment on grounding(assessment_id);

-- ---- prompt_registry (versioned NVW framework prompts) ----
create table if not exists prompt_registry (
  prompt_id    uuid primary key default gen_random_uuid(),
  model_key    text not null,              -- six_streams | ten_ways | synthesis | impact | triage | ...
  version      int  not null default 1,
  system_prompt text not null,
  active       boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (model_key, version)
);

-- ============================================================================
-- Row Level Security — a coach sees only their own cases and everything under them
-- ============================================================================
alter table cases        enable row level security;
alter table transcripts  enable row level security;
alter table assessments  enable row level security;
alter table grounding    enable row level security;

create policy cases_owner on cases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy transcripts_owner on transcripts
  for all using (exists (select 1 from cases c where c.case_id = transcripts.case_id and c.user_id = auth.uid()))
  with check (exists (select 1 from cases c where c.case_id = transcripts.case_id and c.user_id = auth.uid()));

create policy assessments_owner on assessments
  for all using (exists (select 1 from cases c where c.case_id = assessments.case_id and c.user_id = auth.uid()))
  with check (exists (select 1 from cases c where c.case_id = assessments.case_id and c.user_id = auth.uid()));

create policy grounding_owner on grounding
  for all using (exists (
    select 1 from assessments a join cases c on c.case_id = a.case_id
    where a.assessment_id = grounding.assessment_id and c.user_id = auth.uid()))
  with check (exists (
    select 1 from assessments a join cases c on c.case_id = a.case_id
    where a.assessment_id = grounding.assessment_id and c.user_id = auth.uid()));

-- prompt_registry stays server-side (service role only); no public RLS policy on purpose.
alter table prompt_registry enable row level security;

-- ---- keep updated_at fresh ----
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists trg_cases_touch on cases;
create trigger trg_cases_touch before update on cases
  for each row execute function touch_updated_at();
drop trigger if exists trg_assessments_touch on assessments;
create trigger trg_assessments_touch before update on assessments
  for each row execute function touch_updated_at();
