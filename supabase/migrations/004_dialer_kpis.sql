-- Dialer KPIs (daily metrics per agent)
CREATE TABLE IF NOT EXISTS dialer_kpis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name text NOT NULL,
  dial_date date NOT NULL,
  attended boolean DEFAULT false,
  ready_time_minutes decimal(6,1) DEFAULT 0,
  avg_ready_time_minutes decimal(6,1) DEFAULT 0,
  avg_talk_time_minutes decimal(6,1) DEFAULT 0,
  avg_wrap_time_minutes decimal(6,1) DEFAULT 0,
  total_calls integer DEFAULT 0,
  callbacks integer DEFAULT 0,
  appointments integer DEFAULT 0,
  conversion_rate decimal(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dialer_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_dialer" ON dialer_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_dialer" ON dialer_kpis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_dialer" ON dialer_kpis FOR UPDATE TO authenticated USING (true);
