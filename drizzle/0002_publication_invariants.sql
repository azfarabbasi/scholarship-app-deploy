-- Hand-authored migration. Attaches triggers that need tables created in
-- 0001 (CHECK constraints can only see columns on their own row, so
-- cross-table invariants — "a published opportunity has an official
-- source" — must be triggers, not CHECK constraints).

-- RLS policies restrict *which rows* a role sees, but Postgres still checks
-- the ordinary GRANT system first — without these grants every query as
-- anon/authenticated fails with "permission denied for table ..." before RLS
-- is even consulted. This is the same baseline access a real Supabase
-- project sets up automatically when a table is exposed through its data
-- API; RLS (already enabled per-table in 0001) is what actually narrows the
-- rows down from here.
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
--> statement-breakpoint

-- audit_log is append-only, enforced even against our own privileged
-- application connection (see app.reject_mutation() in 0000).
create trigger audit_log_immutable_update
before update on audit_log
for each row execute function app.reject_mutation();
--> statement-breakpoint
create trigger audit_log_immutable_delete
before delete on audit_log
for each row execute function app.reject_mutation();
--> statement-breakpoint

create or replace function app.enforce_opportunity_publication_requirements()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' then
    if not exists (
      select 1 from opportunity_official_sources oos where oos.opportunity_id = new.id
    ) then
      raise exception 'Opportunity % cannot be published without at least one official source', new.id;
    end if;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger opportunities_enforce_publication_requirements
before insert or update on opportunities
for each row execute function app.enforce_opportunity_publication_requirements();
--> statement-breakpoint

-- A verification record must cite at least one official source before it can
-- leave 'pending' (domain model: "Required relationships: at least one
-- OfficialSource"). Deferred to the end of the transaction so the app can
-- insert the verification_records row and its verification_record_sources
-- link rows in the same transaction, in either order.
create or replace function app.enforce_verification_record_has_source()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'pending' and not exists (
    select 1 from verification_record_sources vrs where vrs.verification_record_id = new.id
  ) then
    raise exception 'Verification record % must cite at least one official source before leaving pending status', new.id;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create constraint trigger verification_records_require_source
after insert or update on verification_records
deferrable initially deferred
for each row execute function app.enforce_verification_record_has_source();