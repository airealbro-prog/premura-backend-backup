-- Premura BI Dashboard - Supabase Schema
-- Run this in your Supabase SQL editor to set up the required tables and policies.

-- Create clients table (replaces client_seats)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  company_id text not null unique,
  company_name text not null,
  seats_purchased integer not null default 1,
  seats_active integer not null default 0,
  onboarding_date date,
  launch_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'churned')),
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table clients enable row level security;
alter table appointments_new enable row level security;

-- RLS policies for clients table
create policy "Authenticated users can read clients"
  on clients for select
  to authenticated
  using (true);

create policy "Authenticated users can insert clients"
  on clients for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update clients"
  on clients for update
  to authenticated
  using (true);

create policy "Authenticated users can delete clients"
  on clients for delete
  to authenticated
  using (true);

-- RLS policy for appointments_new table
create policy "Authenticated users can read appointments_new"
  on appointments_new for select
  to authenticated
  using (true);

-- Performance indexes on appointments_new
create index if not exists idx_appointments_new_company_id on appointments_new (company_id);
create index if not exists idx_appointments_new_setter_name on appointments_new (setter_name);
create index if not exists idx_appointments_new_disposition_date on appointments_new (disposition_date);
create index if not exists idx_appointments_new_dq_reason on appointments_new (dq_reason);

-- Enable realtime for both tables
alter publication supabase_realtime add table appointments_new;
alter publication supabase_realtime add table clients;
