-- Backfill: Create client records for companies in appointments_new that don't have a client entry yet.
-- Also updates the appointments' company_id to link them to the new client.
--
-- Run this AFTER 002_auto_create_clients_trigger.sql to catch all existing orphaned appointments.

-- Step 1: Insert missing clients
INSERT INTO clients (company_id, company_name, seats_purchased, seats_active, status, created_at)
SELECT DISTINCT
  'auto_' || LOWER(REGEXP_REPLACE(TRIM(a."Company Name"), '[^a-zA-Z0-9]+', '_', 'g')),
  TRIM(a."Company Name"),
  1,
  0,
  'active',
  NOW()
FROM appointments_new a
WHERE TRIM(a."Company Name") IS NOT NULL
  AND TRIM(a."Company Name") != ''
  AND NOT EXISTS (
    SELECT 1 FROM clients c
    WHERE LOWER(TRIM(c.company_name)) = LOWER(TRIM(a."Company Name"))
  )
ON CONFLICT (company_id) DO NOTHING;

-- Step 2: Link orphaned appointments to their clients
UPDATE appointments_new a
SET company_id = c.company_id
FROM clients c
WHERE LOWER(TRIM(c.company_name)) = LOWER(TRIM(a."Company Name"))
  AND (a.company_id IS NULL OR a.company_id = '' OR NOT EXISTS (
    SELECT 1 FROM clients WHERE company_id = a.company_id
  ));

-- Step 3: Verify the results
-- SELECT c.company_id, c.company_name, COUNT(a.id) as appointment_count
-- FROM clients c
-- LEFT JOIN appointments_new a ON a.company_id = c.company_id
-- GROUP BY c.company_id, c.company_name
-- ORDER BY c.company_name;
