-- Run AFTER auth is wired and at least one real coach account exists (HANDOFF §8).
-- cases.user_id NOT NULL was temporarily dropped for hand-testing; restore it so RLS
-- (user_id = auth.uid()) is enforced for every row.

-- 1) Backfill any rows created during hand-testing that have a null user_id.
--    Replace with the real coach's auth.users.id, or delete the orphan test rows.
-- update cases set user_id = '<COACH_AUTH_UID>' where user_id is null;

-- 2) Restore the constraint + default.
alter table cases alter column user_id set default auth.uid();
alter table cases alter column user_id set not null;
