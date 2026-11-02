-- ============================================================
-- PermitEarly — Initial Schema
-- ============================================================

-- Permits (public read, service-role write)
create table if not exists permits (
  id                 uuid primary key default gen_random_uuid(),
  permit_number      text unique,
  permit_address     text,
  neighborhood       text,
  zip_code           text,
  application_type   text,
  worktype           text,
  estimated_cost     numeric,
  contractor_name    text,
  contractor_phone   text,
  issue_permit_date  date,
  application_status text,
  trades_tagged      text[],
  pulled_at          timestamptz default now(),
  raw_data           jsonb
);

create index if not exists permits_issue_date_idx  on permits (issue_permit_date desc);
create index if not exists permits_zip_idx         on permits using gin (zip_code);
create index if not exists permits_trades_idx      on permits using gin (trades_tagged);

-- Contractors (service-role only)
create table if not exists contractors (
  id                      uuid primary key default gen_random_uuid(),
  email                   text unique not null,
  company_name            text,
  trade                   text not null,
  zip_codes               text[] not null,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text default 'trial',
  trial_ends_at           timestamptz,
  created_at              timestamptz default now()
);

-- Digest log
create table if not exists digest_log (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid references contractors(id),
  permits_sent   int,
  permit_ids     uuid[],
  sent_at        timestamptz default now()
);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table permits     enable row level security;
alter table contractors enable row level security;
alter table digest_log  enable row level security;

-- permits: public read
create policy "permits_public_read"
  on permits for select
  using (true);

-- contractors: service role only (default deny for anon/authenticated)
-- (No policy = deny by default for non-service roles)

-- digest_log: service role only
-- (No policy = deny by default)
