-- Agent Journey tables: agent_profiles, training_sessions, agent_updates, hiring_funnel
-- Run this migration to create the tables needed for the Agent Journey dashboard.
-- Note: dialer_kpis was already created in 004_dialer_kpis.sql

-- 1. Agent Profiles
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  company_id TEXT,
  email TEXT,
  phone TEXT,
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave')),
  role TEXT DEFAULT 'setter',
  team_lead TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_name ON agent_profiles (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_company ON agent_profiles (company_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_status ON agent_profiles (status);

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent_profiles"
  ON agent_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agent_profiles"
  ON agent_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agent_profiles"
  ON agent_profiles FOR UPDATE
  TO authenticated
  USING (true);

-- 2. Training Sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  session_date TIMESTAMPTZ NOT NULL,
  trainer TEXT,
  recording_link TEXT,
  attendees TEXT[],
  completion_status TEXT DEFAULT 'scheduled' CHECK (completion_status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions (session_date);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read training_sessions"
  ON training_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert training_sessions"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update training_sessions"
  ON training_sessions FOR UPDATE
  TO authenticated
  USING (true);

-- 3. Agent Updates
CREATE TABLE IF NOT EXISTS agent_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'note' CHECK (update_type IN ('note', 'warning', 'promotion', 'schedule_change', 'termination', 'performance')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_updates_agent ON agent_updates (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_updates_type ON agent_updates (update_type);
CREATE INDEX IF NOT EXISTS idx_agent_updates_date ON agent_updates (created_at);

ALTER TABLE agent_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent_updates"
  ON agent_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agent_updates"
  ON agent_updates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Hiring Funnel
CREATE TABLE IF NOT EXISTS hiring_funnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  ad_campaign TEXT,
  stage TEXT NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_funnel_stage ON hiring_funnel (stage);
CREATE INDEX IF NOT EXISTS idx_hiring_funnel_date ON hiring_funnel (applied_date);

ALTER TABLE hiring_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hiring_funnel"
  ON hiring_funnel FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hiring_funnel"
  ON hiring_funnel FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hiring_funnel"
  ON hiring_funnel FOR UPDATE
  TO authenticated
  USING (true);
