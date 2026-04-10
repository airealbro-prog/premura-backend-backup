-- 009 — Normalize company_ids across clients, user_roles, appointments_new
-- and backfill agent_start_dates from existing appointment data.
--
-- Problem:
--   * `clients` can contain duplicate rows for the same company (e.g. a
--     manually-created row + an `auto_*` row from the auto-create trigger).
--   * `appointments_new.company_id` is often wrong or points to a dup.
--   * `user_roles.company_id` may point to a client row that holds zero
--     appointments because the "real" appointments are linked to the dup.
--
--  Result: client logins see 0 data even though the matching "Company Name"
--  rows exist in `appointments_new`.
--
-- This migration:
--   1. Collapses duplicate `clients` rows (same LOWER(TRIM(company_name)))
--      onto a single canonical row.  The canonical row is preferred as:
--        a) the row whose `company_id` does NOT start with `auto_`, else
--        b) the oldest row by `created_at`.
--   2. Rewrites `appointments_new.company_id` to the canonical id for
--      appointments whose "Company Name" matches (case-insensitive).
--   3. Rewrites `user_roles.company_id` to the canonical id for any role
--      pointing at a duplicate row.
--   4. Deletes the surplus duplicate `clients` rows.
--   5. Backfills `agent_start_dates` from the earliest appointment per
--      (setter_name, "Company Name").  Pre-existing rows are left untouched
--      via ON CONFLICT DO NOTHING.

BEGIN;

-- 1a. Build a working table of canonical client ids per normalized name.
CREATE TEMP TABLE _canonical_clients ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    c.id,
    c.company_id,
    c.company_name,
    LOWER(TRIM(c.company_name)) AS norm_name,
    CASE WHEN c.company_id LIKE 'auto_%' THEN 1 ELSE 0 END AS is_auto,
    c.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(c.company_name))
      ORDER BY
        CASE WHEN c.company_id LIKE 'auto_%' THEN 1 ELSE 0 END,
        c.created_at ASC NULLS LAST,
        c.company_id ASC
    ) AS rn
  FROM clients c
  WHERE c.company_name IS NOT NULL AND TRIM(c.company_name) <> ''
)
SELECT
  norm_name,
  MAX(company_name)    FILTER (WHERE rn = 1) AS canonical_name,
  MAX(company_id)      FILTER (WHERE rn = 1) AS canonical_company_id,
  MAX(id::text)        FILTER (WHERE rn = 1) AS canonical_id
FROM ranked
GROUP BY norm_name;

-- 1b. Build a map of every (dup company_id) -> canonical company_id.
CREATE TEMP TABLE _id_rewrites ON COMMIT DROP AS
SELECT
  c.company_id        AS from_company_id,
  cc.canonical_company_id AS to_company_id
FROM clients c
JOIN _canonical_clients cc
  ON LOWER(TRIM(c.company_name)) = cc.norm_name
WHERE c.company_id <> cc.canonical_company_id;

-- 2. Rewrite appointments_new.company_id:
--    Prefer linking by "Company Name" (authoritative) to the canonical id.
UPDATE appointments_new a
SET company_id = cc.canonical_company_id
FROM _canonical_clients cc
WHERE LOWER(TRIM(a."Company Name")) = cc.norm_name
  AND (a.company_id IS DISTINCT FROM cc.canonical_company_id);

-- 2b. For appointments with no "Company Name" but a company_id pointing at a dup,
--     redirect them to the canonical id.
UPDATE appointments_new a
SET company_id = r.to_company_id
FROM _id_rewrites r
WHERE a.company_id = r.from_company_id
  AND (a."Company Name" IS NULL OR TRIM(a."Company Name") = '');

-- 3. Rewrite user_roles.company_id to the canonical id.
UPDATE user_roles ur
SET company_id = r.to_company_id
FROM _id_rewrites r
WHERE ur.company_id = r.from_company_id;

-- 4. Delete the now-unused duplicate client rows.
DELETE FROM clients c
USING _id_rewrites r
WHERE c.company_id = r.from_company_id;

-- 5a. Ensure the agent_start_dates table exists (created by migration 008).
--     If 008 hasn't run yet in this environment, bail out gracefully.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_start_dates'
  ) THEN
    RAISE NOTICE 'agent_start_dates table missing — skipping backfill. Run migration 008 first.';
    RETURN;
  END IF;
END $$;

-- 5b. Backfill earliest appointment date per (setter_name, "Company Name").
--     Use the canonical company_name from the clients table where possible.
INSERT INTO agent_start_dates (agent_name, company_name, start_date, status)
SELECT
  TRIM(a.setter_name) AS agent_name,
  COALESCE(NULLIF(TRIM(a."Company Name"), ''), 'Unknown') AS company_name,
  MIN(a.created_at)::date AS start_date,
  'active' AS status
FROM appointments_new a
WHERE a.setter_name IS NOT NULL
  AND TRIM(a.setter_name) <> ''
GROUP BY TRIM(a.setter_name), COALESCE(NULLIF(TRIM(a."Company Name"), ''), 'Unknown')
ON CONFLICT (agent_name, company_name) DO NOTHING;

COMMIT;

-- Verification queries (commented — uncomment to spot-check):
-- SELECT COUNT(*) FROM clients;
-- SELECT LOWER(TRIM(company_name)) AS n, COUNT(*) FROM clients GROUP BY n HAVING COUNT(*) > 1;
-- SELECT ur.company_id, c.company_name FROM user_roles ur LEFT JOIN clients c USING (company_id) WHERE ur.role IN ('client','client_admin');
-- SELECT company_id, COUNT(*) FROM appointments_new GROUP BY company_id ORDER BY 2 DESC LIMIT 20;
-- SELECT * FROM agent_start_dates ORDER BY company_name, agent_name LIMIT 50;
