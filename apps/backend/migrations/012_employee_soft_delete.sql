-- Soft-delete for employees: mark as deleted instead of hard-delete so
-- historical time entries are preserved.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Replace CASCADE with RESTRICT on the employee FK, guarded for idempotency.
DO $$
DECLARE
  cur_rule TEXT;
BEGIN
  SELECT rc.delete_rule INTO cur_rule
  FROM information_schema.referential_constraints rc
  WHERE rc.constraint_name = 'time_entries_employee_id_fkey';

  IF cur_rule = 'CASCADE' THEN
    ALTER TABLE time_entries DROP CONSTRAINT time_entries_employee_id_fkey;
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
  END IF;
END $$;
