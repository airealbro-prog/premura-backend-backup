-- Ticket System tables: tickets, ticket_comments
-- Run this migration to create the tables needed for the Ticket System.

-- 1. Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'bug', 'feature', 'billing', 'access', 'data', 'other')),
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  company_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets (company_id);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (true);

-- 2. Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments (ticket_id);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ticket_comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ticket_comments"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);
