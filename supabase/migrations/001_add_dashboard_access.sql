-- Add dashboard_access column to user_roles
-- Stores which dashboards each user can access: ['backend'], ['frontend'], or ['backend', 'frontend']
-- Defaults to ['backend'] for backward compatibility with existing employees.
-- agency_admin always gets both dashboards (enforced in app code), but the column is still populated.

ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS dashboard_access text[] DEFAULT '{backend}';

-- Backfill existing rows that have NULL
UPDATE user_roles
SET dashboard_access = '{backend}'
WHERE dashboard_access IS NULL;
