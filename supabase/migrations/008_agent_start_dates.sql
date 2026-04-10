-- Agent start dates table for accurate achievement calculation.
-- Each agent's start date determines the effective time window for their achievement %.

CREATE TABLE IF NOT EXISTS agent_start_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  client_id TEXT,
  company_name TEXT,
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'training', 'inactive', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_name, company_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_start_dates_name ON agent_start_dates (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_start_dates_company ON agent_start_dates (company_name);

ALTER TABLE agent_start_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent_start_dates"
  ON agent_start_dates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent_start_dates"
  ON agent_start_dates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
