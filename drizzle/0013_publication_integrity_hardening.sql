-- Existing verification rows predate the approver column introduced in 0010.
-- NOT VALID preserves those historical rows while enforcing the rule for all
-- future inserts/updates; the publication trigger below also refuses to use a
-- grandfathered row with no approver.
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_verified_requires_approver" CHECK ("verification_records"."status" <> 'verified' OR "verification_records"."approved_by_staff_profile_id" IS NOT NULL) NOT VALID;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_no_self_review" CHECK ("review_assignments"."subject_author_staff_profile_id" IS NULL OR "review_assignments"."reviewer_staff_profile_id" <> "review_assignments"."subject_author_staff_profile_id" OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = "review_assignments"."reviewer_staff_profile_id"::text) NOT VALID;
--> statement-breakpoint

-- Rebuild the publication gate so every qualifying child belongs to this
-- opportunity and represents a completed, approved workflow. In particular,
-- a version from another opportunity can no longer be supplied as
-- current_approved_version_id, and a newer incomplete verification no longer
-- masks an older qualifying one.
create or replace function app.enforce_opportunity_publication_requirements()
returns trigger
language plpgsql
as $$
declare
  qualifying_source_id uuid;
  qualifying_verification_id uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select oos.official_source_id into qualifying_source_id
  from opportunity_official_sources oos
  join official_sources os on os.id = oos.official_source_id
  where oos.opportunity_id = new.id
    and os.status in ('confirmed-official', 'active')
    and os.last_checked_at is not null
  limit 1;

  if qualifying_source_id is null then
    raise exception 'Opportunity % cannot be published without a confirmed-official source that has been checked', new.id;
  end if;

  select vr.id into qualifying_verification_id
  from verification_records vr
  where vr.subject_kind = 'opportunity'
    and vr.subject_id = new.id
    and vr.opportunity_id = new.id
    and vr.status = 'verified'
    and vr.approved_by_staff_profile_id is not null
    and vr.checked_at > (now() - interval '400 days')
    and exists (
      select 1
      from source_evidence se
      where se.verification_record_id = vr.id
        and se.opportunity_id = new.id
        and se.status = 'accepted'
        and se.approved_by_staff_profile_id is not null
    )
  order by vr.checked_at desc
  limit 1;

  if qualifying_verification_id is null then
    raise exception 'Opportunity % cannot be published without a current approved verification tied to accepted evidence', new.id;
  end if;

  if new.current_approved_version_id is null or not exists (
    select 1
    from opportunity_versions ov
    where ov.id = new.current_approved_version_id
      and ov.opportunity_id = new.id
      and ov.review_outcome = 'approve'
  ) then
    raise exception 'Opportunity %''s current_approved_version_id does not point at its own approved revision', new.id;
  end if;

  if not exists (
    select 1
    from review_assignments ra
    where ra.subject_kind = 'opportunity'
      and ra.subject_id = new.id
      and ra.opportunity_id = new.id
      and ra.status = 'completed'
      and ra.completed_at is not null
      and ra.decision = 'mark-reviewed'
      and (
        ra.subject_author_staff_profile_id is null
        or ra.reviewer_staff_profile_id <> ra.subject_author_staff_profile_id
        or COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ra.reviewer_staff_profile_id::text
      )
  ) then
    raise exception 'Opportunity % has no valid completed review assignment', new.id;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

create or replace function app.enforce_evidence_verification_matches_opportunity()
returns trigger
language plpgsql
as $$
begin
  if new.verification_record_id is not null and not exists (
    select 1
    from verification_records vr
    where vr.id = new.verification_record_id
      and vr.subject_kind = 'opportunity'
      and vr.subject_id = new.opportunity_id
      and vr.opportunity_id = new.opportunity_id
  ) then
    raise exception 'Source evidence % references a verification record belonging to another subject or opportunity', new.id;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger source_evidence_verification_matches_opportunity
before insert or update of verification_record_id, opportunity_id on source_evidence
for each row execute function app.enforce_evidence_verification_matches_opportunity();
--> statement-breakpoint

create or replace function app.enforce_verification_source_matches_opportunity()
returns trigger
language plpgsql
as $$
declare
  target_opportunity_id uuid;
begin
  select vr.opportunity_id into target_opportunity_id
  from verification_records vr
  where vr.id = new.verification_record_id;

  if target_opportunity_id is not null and not exists (
    select 1
    from opportunity_official_sources oos
    where oos.opportunity_id = target_opportunity_id
      and oos.official_source_id = new.official_source_id
  ) then
    raise exception 'Verification source % is not linked to verification opportunity %', new.official_source_id, target_opportunity_id;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger verification_record_sources_match_opportunity
before insert or update on verification_record_sources
for each row execute function app.enforce_verification_source_matches_opportunity();
