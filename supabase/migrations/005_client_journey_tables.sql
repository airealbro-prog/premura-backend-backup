-- Client Journey tables: client_payments, client_meetings, client_profiles
-- Run this migration to create the tables needed for the Client Journey dashboard.

-- 1. Client Payments
CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  invoice_number TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_company ON client_payments (company_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON client_payments (payment_date);

ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client_payments"
  ON client_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client_payments"
  ON client_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_payments"
  ON client_payments FOR UPDATE
  TO authenticated
  USING (true);

-- 2. Client Meetings
CREATE TABLE IF NOT EXISTS client_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  attendees TEXT[],
  fathom_link TEXT,
  ai_summary TEXT,
  action_items TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_meetings_company ON client_meetings (company_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_date ON client_meetings (meeting_date);

ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client_meetings"
  ON client_meetings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client_meetings"
  ON client_meetings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_meetings"
  ON client_meetings FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Client Profiles (extended info beyond the base clients table)
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL UNIQUE,
  business_type TEXT,
  industry TEXT,
  website TEXT,
  address TEXT,
  onboarding_notes TEXT,
  account_manager TEXT,
  lifetime_value NUMERIC(12, 2) DEFAULT 0,
  churn_risk_score NUMERIC(5, 2) DEFAULT 0,
  nps_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_company ON client_profiles (company_id);

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client_profiles"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client_profiles"
  ON client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_profiles"
  ON client_profiles FOR UPDATE
  TO authenticated
  USING (true);
