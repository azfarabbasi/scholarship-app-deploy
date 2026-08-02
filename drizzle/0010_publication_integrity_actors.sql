ALTER TABLE "funding_benefits" ADD COLUMN "created_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD COLUMN "approved_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "official_sources" ADD COLUMN "created_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "official_sources" ADD COLUMN "approved_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD COLUMN "approved_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD COLUMN "created_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD COLUMN "approved_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD COLUMN "created_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD COLUMN "approved_by_staff_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_no_self_approval" CHECK ("funding_benefits"."approved_by_staff_profile_id" IS NULL OR "funding_benefits"."created_by_staff_profile_id" IS NULL OR "funding_benefits"."approved_by_staff_profile_id" <> "funding_benefits"."created_by_staff_profile_id");--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_published_requires_approver" CHECK ("funding_benefits"."status" <> 'published' OR "funding_benefits"."created_by_staff_profile_id" IS NULL OR "funding_benefits"."approved_by_staff_profile_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_no_self_approval" CHECK ("official_sources"."approved_by_staff_profile_id" IS NULL OR "official_sources"."created_by_staff_profile_id" IS NULL OR "official_sources"."approved_by_staff_profile_id" <> "official_sources"."created_by_staff_profile_id");--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_confirmed_requires_approver" CHECK ("official_sources"."status" = 'candidate' OR "official_sources"."created_by_staff_profile_id" IS NULL OR "official_sources"."approved_by_staff_profile_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_no_self_approval" CHECK ("source_evidence"."approved_by_staff_profile_id" IS NULL OR "source_evidence"."approved_by_staff_profile_id" <> "source_evidence"."captured_by_staff_profile_id");--> statement-breakpoint
-- NOT VALID: unlike every other new CHECK in this migration, existing
-- source_evidence rows already have status='accepted' with no approver
-- tracked (approved_by_staff_profile_id is a brand-new column, so it is NULL
-- on every pre-existing row) — a validated ADD CONSTRAINT would reject this
-- migration outright against real data. NOT VALID still enforces the rule on
-- every future INSERT/UPDATE; it only skips checking rows that already exist.
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_accepted_requires_approver" CHECK ("source_evidence"."status" <> 'accepted' OR "source_evidence"."approved_by_staff_profile_id" IS NOT NULL) NOT VALID;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_no_self_approval" CHECK ("opportunity_document_requirements"."approved_by_staff_profile_id" IS NULL OR "opportunity_document_requirements"."created_by_staff_profile_id" IS NULL OR "opportunity_document_requirements"."approved_by_staff_profile_id" <> "opportunity_document_requirements"."created_by_staff_profile_id");--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_published_requires_approver" CHECK ("opportunity_document_requirements"."status" <> 'published' OR "opportunity_document_requirements"."created_by_staff_profile_id" IS NULL OR "opportunity_document_requirements"."approved_by_staff_profile_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_no_self_approval" CHECK ("eligibility_rules"."approved_by_staff_profile_id" IS NULL OR "eligibility_rules"."created_by_staff_profile_id" IS NULL OR "eligibility_rules"."approved_by_staff_profile_id" <> "eligibility_rules"."created_by_staff_profile_id");--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_active_requires_approver" CHECK ("eligibility_rules"."status" <> 'active' OR "eligibility_rules"."created_by_staff_profile_id" IS NULL OR "eligibility_rules"."approved_by_staff_profile_id" IS NOT NULL);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-authored from here: strengthens the Checkpoint 2 publication gate
-- (0002_publication_invariants.sql only checked "at least one official
-- source is linked, of any status"). This closes the launch-audit finding
-- that a candidate/unconfirmed source, a stale/never-verified record, or an
-- unreviewed live edit could each independently let unverified content reach
-- the public catalogue.
--
-- Freshness window: 400 days (~13 months) — a real annual verification cycle
-- plus a reasonable buffer, not an arbitrary number tied to any one
-- opportunity's own cycle. Chosen here, in one place, so it can be revisited
-- without touching application code.
-- ---------------------------------------------------------------------------

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

  -- 1. At least one linked, confirmed-official (or active) source with a checked-at timestamp.
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

  -- 2. A current, completed, non-stale verified verification record for the opportunity itself.
  select vr.id into qualifying_verification_id
  from verification_records vr
  where vr.subject_kind = 'opportunity'
    and vr.subject_id = new.id
    and vr.status = 'verified'
    and vr.checked_at > (now() - interval '400 days')
  order by vr.checked_at desc
  limit 1;

  if qualifying_verification_id is null then
    raise exception 'Opportunity % cannot be published without a current (checked within 400 days), non-stale verified verification record', new.id;
  end if;

  -- 3. That verification record must be tied to accepted evidence.
  if not exists (
    select 1 from source_evidence se
    where se.verification_record_id = qualifying_verification_id
      and se.status = 'accepted'
  ) then
    raise exception 'Opportunity %''s verification record % is not tied to any accepted source evidence', new.id, qualifying_verification_id;
  end if;

  -- 4. The current public revision was independently approved (a version with review_outcome = 'approve').
  if new.current_approved_version_id is null or not exists (
    select 1 from opportunity_versions ov
    where ov.id = new.current_approved_version_id
      and ov.review_outcome = 'approve'
  ) then
    raise exception 'Opportunity %''s current_approved_version_id does not point at an independently approved revision', new.id;
  end if;

  -- 5. An accepted or completed review assignment exists for this exact subject.
  if not exists (
    select 1 from review_assignments ra
    where ra.subject_kind = 'opportunity'
      and ra.subject_id = new.id
      and ra.status in ('accepted', 'completed')
  ) then
    raise exception 'Opportunity % has no accepted/completed review assignment', new.id;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Anti-demotion guards: once a published opportunity depends on a source,
-- verification record, or evidence row as its ONLY qualifying one, that row
-- can no longer be silently downgraded or unlinked out from under it. A
-- reviewer must add/attach a replacement first (or unpublish the
-- opportunity), rather than the demotion happening implicitly.
-- ---------------------------------------------------------------------------

create or replace function app.prevent_source_demotion_under_published()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('confirmed-official', 'active') or new.status = old.status then
    return new;
  end if;

  if exists (
    select 1
    from opportunity_official_sources oos
    join opportunities o on o.id = oos.opportunity_id
    where oos.official_source_id = new.id
      and o.status = 'published'
      and not exists (
        select 1
        from opportunity_official_sources oos2
        join official_sources os2 on os2.id = oos2.official_source_id
        where oos2.opportunity_id = oos.opportunity_id
          and os2.id <> new.id
          and os2.status in ('confirmed-official', 'active')
          and os2.last_checked_at is not null
      )
  ) then
    raise exception 'Official source % cannot be demoted to % — it is the only qualifying source for a published opportunity', new.id, new.status;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

create trigger official_sources_prevent_demotion_under_published
before update on official_sources
for each row execute function app.prevent_source_demotion_under_published();
--> statement-breakpoint

create or replace function app.prevent_verification_record_demotion_under_published()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'verified' or new.status = old.status or old.status <> 'verified' then
    return new;
  end if;

  if new.subject_kind = 'opportunity' and exists (
    select 1
    from opportunities o
    where o.id = new.subject_id
      and o.status = 'published'
      and not exists (
        select 1 from verification_records vr2
        where vr2.subject_kind = 'opportunity'
          and vr2.subject_id = new.subject_id
          and vr2.id <> new.id
          and vr2.status = 'verified'
          and vr2.checked_at > (now() - interval '400 days')
      )
  ) then
    raise exception 'Verification record % cannot leave verified status — it is the only current verified record for a published opportunity', new.id;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

create trigger verification_records_prevent_demotion_under_published
before update on verification_records
for each row execute function app.prevent_verification_record_demotion_under_published();
--> statement-breakpoint

create or replace function app.prevent_last_official_source_unlink()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from opportunities o
    where o.id = old.opportunity_id
      and o.status = 'published'
      and not exists (
        select 1
        from opportunity_official_sources oos
        join official_sources os on os.id = oos.official_source_id
        where oos.opportunity_id = old.opportunity_id
          and oos.official_source_id <> old.official_source_id
          and os.status in ('confirmed-official', 'active')
          and os.last_checked_at is not null
      )
  ) then
    raise exception 'Cannot unlink official source % — it is the only qualifying source for published opportunity %', old.official_source_id, old.opportunity_id;
  end if;

  return old;
end;
$$;
--> statement-breakpoint

create trigger opportunity_official_sources_prevent_last_unlink
before delete on opportunity_official_sources
for each row execute function app.prevent_last_official_source_unlink();
--> statement-breakpoint

create or replace function app.prevent_last_accepted_evidence_demotion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' or new.status = old.status or old.status <> 'accepted' then
    return new;
  end if;

  if exists (
    select 1 from opportunities o
    where o.id = new.opportunity_id
      and o.status = 'published'
      and not exists (
        select 1 from source_evidence se2
        where se2.opportunity_id = new.opportunity_id
          and se2.id <> new.id
          and se2.status = 'accepted'
      )
  ) then
    raise exception 'Source evidence % cannot leave accepted status — it is the only accepted evidence for a published opportunity', new.id;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

create trigger source_evidence_prevent_last_accepted_demotion
before update on source_evidence
for each row execute function app.prevent_last_accepted_evidence_demotion();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Child-ID cross-validation: every "which evidence backs this claim" pointer
-- must belong to the SAME opportunity as the row carrying it. Without this, a
-- client bug (or a malicious staff request) could attach evidence, a
-- document requirement, an eligibility rule, or a funding benefit from
-- Opportunity A's review folder onto Opportunity B.
-- ---------------------------------------------------------------------------

create or replace function app.enforce_source_evidence_matches_opportunity_source()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from opportunity_official_sources oos
    where oos.opportunity_id = new.opportunity_id
      and oos.official_source_id = new.official_source_id
  ) then
    raise exception 'Source evidence % references official source % which is not linked to opportunity %', new.id, new.official_source_id, new.opportunity_id;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger source_evidence_matches_opportunity_source
before insert or update on source_evidence
for each row execute function app.enforce_source_evidence_matches_opportunity_source();
--> statement-breakpoint

create or replace function app.enforce_child_source_evidence_matches_opportunity()
returns trigger
language plpgsql
as $$
begin
  if new.source_evidence_id is not null and not exists (
    select 1 from source_evidence se
    where se.id = new.source_evidence_id
      and se.opportunity_id = new.opportunity_id
  ) then
    raise exception '% % references source evidence % belonging to a different opportunity', TG_TABLE_NAME, new.id, new.source_evidence_id;
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger opportunity_document_requirements_evidence_matches_opportunity
before insert or update on opportunity_document_requirements
for each row execute function app.enforce_child_source_evidence_matches_opportunity();
--> statement-breakpoint

create trigger eligibility_rules_evidence_matches_opportunity
before insert or update on eligibility_rules
for each row execute function app.enforce_child_source_evidence_matches_opportunity();
--> statement-breakpoint

create trigger funding_benefits_evidence_matches_opportunity
before insert or update on funding_benefits
for each row execute function app.enforce_child_source_evidence_matches_opportunity();