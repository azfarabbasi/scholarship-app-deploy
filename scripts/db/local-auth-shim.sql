-- TEST-ONLY shim. Never applied to a real Supabase project (Supabase already
-- provides a real `auth` schema and `auth.uid()`; running this against it
-- would be redundant, not harmful, but it is unnecessary — the db:test /
-- db:reset:test scripts apply this only to the ephemeral local Postgres
-- container so RLS policies can be exercised without a live Supabase
-- project).
--
-- `auth.uid()` normally reads the caller's JWT `sub` claim from a
-- request-scoped Postgres setting. Here it reads a plain session GUC that
-- tests set explicitly with:
--   select set_config('app.test_current_staff_id', '<uuid>', true);
--   set local role authenticated; -- or anon / service_role
-- so a policy written against `auth.uid()` behaves identically to what it
-- would do against a real Supabase project.

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.test_current_staff_id', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select current_setting('app.test_current_staff_role', true);
$$;
