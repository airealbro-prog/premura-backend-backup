-- Add disposition tracking columns to appointments_new
-- These are populated by the disposition-webhook Edge Function
-- when closers fill out the GHL disposition form after appointments.

ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS disposition_status TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS disposition_date TIMESTAMPTZ;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS disposition_notes TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS dq_reason TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS system_size TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS reschedule_date DATE;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS reschedule_time TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE appointments_new ADD COLUMN IF NOT EXISTS job_size TEXT;
