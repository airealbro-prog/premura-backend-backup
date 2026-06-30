-- Premura BI Dashboard - Supabase Schema
-- Run this in your Supabase SQL editor to set up the required tables and policies.

-- ============================================================
-- 1. DATA TABLES
-- ============================================================

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
  -- Internal test accounts (ZTEST*, Test Solar, …): kept in the DB for testing
  -- but excluded from all staff-facing reporting and the performance metrics.
  is_test boolean not null default false,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. USER ROLES TABLE
-- ============================================================

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('agency_admin', 'backend_employee', 'frontend_employee', 'client')),
  company_id text,  -- NULL for admin/employees, set for clients (links to clients.company_id)
  permissions jsonb default '{}',  -- granular permissions like {"can_see_contacts": true, "can_see_recordings": true}
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- RLS on user_roles
alter table user_roles enable row level security;

-- Users can only read their own role
create policy "Users can read own role"
  on user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 3. ROW LEVEL SECURITY - CLIENTS TABLE
-- ============================================================

alter table clients enable row level security;

-- Drop old permissive anon policies (run these first to clean up)
-- drop policy if exists "Allow public read access to clients" on clients;
-- drop policy if exists "Allow public insert access to clients" on clients;
-- drop policy if exists "Allow public update access to clients" on clients;
-- drop policy if exists "Allow public delete access to clients" on clients;

-- Agency admins: full access to all clients
create policy "Agency admins read all clients"
  on clients for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'agency_admin'
    )
  );

-- Backend employees: read all clients (permissions control what columns/data they see in the app)
create policy "Backend employees read all clients"
  on clients for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'backend_employee'
    )
  );

-- Frontend employees: read all clients
create policy "Frontend employees read all clients"
  on clients for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'frontend_employee'
    )
  );

-- Clients: can only read their own company
create policy "Clients read own company"
  on clients for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'client'
      and user_roles.company_id = clients.company_id
    )
  );

-- Agency admins: full write access to clients
create policy "Agency admins insert clients"
  on clients for insert
  to authenticated
  with check (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'agency_admin'
    )
  );

create policy "Agency admins update clients"
  on clients for update
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'agency_admin'
    )
  );

create policy "Agency admins delete clients"
  on clients for delete
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'agency_admin'
    )
  );

-- ============================================================
-- 4. ROW LEVEL SECURITY - APPOINTMENTS_NEW TABLE
-- ============================================================

alter table appointments_new enable row level security;

-- Drop old permissive anon policy
-- drop policy if exists "Allow public read access to appointments_new" on appointments_new;

-- Agency admins: read all appointments
create policy "Agency admins read all appointments"
  on appointments_new for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'agency_admin'
    )
  );

-- Backend employees: read all appointments
create policy "Backend employees read all appointments"
  on appointments_new for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'backend_employee'
    )
  );

-- Frontend employees: read all appointments
create policy "Frontend employees read all appointments"
  on appointments_new for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'frontend_employee'
    )
  );

-- Clients: can only read appointments for their own company
create policy "Clients read own appointments"
  on appointments_new for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
      and user_roles.role = 'client'
      and (
        user_roles.company_id = appointments_new.company_id
        or user_roles.company_id = appointments_new."Company Name"
      )
    )
  );

-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================

create index if not exists idx_appointments_new_company_id on appointments_new (company_id);
create index if not exists idx_appointments_new_setter_name on appointments_new (setter_name);
create index if not exists idx_appointments_new_disposition_date on appointments_new (disposition_date);
create index if not exists idx_appointments_new_dq_reason on appointments_new (dq_reason);
create index if not exists idx_user_roles_user_id on user_roles (user_id);

-- ============================================================
-- 6. REALTIME
-- ============================================================

alter publication supabase_realtime add table appointments_new;
alter publication supabase_realtime add table clients;
