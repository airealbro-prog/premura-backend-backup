-- Auto-create client records when new companies appear in appointments_new.
--
-- The appointments_new table has a "Company Name" text field and a company_id text field.
-- The clients table requires company_id (text, NOT NULL, UNIQUE) and company_name (text, NOT NULL).
-- This trigger fires AFTER INSERT on appointments_new and:
--   1. Checks if the appointment's "Company Name" already has a matching client
--   2. If not, creates a new client with an auto-generated company_id
--   3. Updates the appointment's company_id to link it to the client

CREATE OR REPLACE FUNCTION auto_create_client_from_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_company_name text;
  v_client_company_id text;
BEGIN
  -- Get the company name from the appointment
  v_company_name := NULLIF(TRIM(NEW."Company Name"), '');

  -- Only proceed if we have a company name
  IF v_company_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to find an existing client by company_name (case-insensitive)
  SELECT company_id INTO v_client_company_id
  FROM clients
  WHERE LOWER(TRIM(company_name)) = LOWER(v_company_name)
  LIMIT 1;

  -- If no client found by name, try by company_id if the appointment has one
  IF v_client_company_id IS NULL AND NEW.company_id IS NOT NULL AND NEW.company_id != '' THEN
    SELECT company_id INTO v_client_company_id
    FROM clients
    WHERE company_id = NEW.company_id
    LIMIT 1;
  END IF;

  -- If still no match, create a new client
  IF v_client_company_id IS NULL THEN
    -- Generate a company_id slug from the company name
    v_client_company_id := 'auto_' || LOWER(REGEXP_REPLACE(v_company_name, '[^a-zA-Z0-9]+', '_', 'g'));

    -- Ensure uniqueness by appending random suffix if slug already exists
    IF EXISTS (SELECT 1 FROM clients WHERE company_id = v_client_company_id) THEN
      v_client_company_id := v_client_company_id || '_' || SUBSTR(gen_random_uuid()::text, 1, 8);
    END IF;

    INSERT INTO clients (company_id, company_name, seats_purchased, seats_active, status, created_at)
    VALUES (v_client_company_id, v_company_name, 1, 0, 'active', NOW());

    RAISE NOTICE 'Auto-created client: % (company_id: %)', v_company_name, v_client_company_id;
  END IF;

  -- Link the appointment to the client if company_id is missing or doesn't match
  IF NEW.company_id IS NULL OR NEW.company_id = '' OR NEW.company_id != v_client_company_id THEN
    UPDATE appointments_new
    SET company_id = v_client_company_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_client ON appointments_new;
CREATE TRIGGER trigger_auto_create_client
  AFTER INSERT ON appointments_new
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_client_from_appointment();
