-- Hand-authored migration (Checkpoint 5). Three jobs, following the exact
-- precedents set by 0004_student_workspace_grants.sql and
-- 0006_discovery_grants_and_search.sql:
--
-- 1. Grant baseline. Every new table already inherited a blanket SELECT for
--    `anon`/`authenticated` and full CRUD for `service_role` from 0002's
--    `alter default privileges`. That is correct for the public source
--    tables (retrieval must work for signed-out guests) and for the
--    staff/internal tables (staff mutations go through server actions using
--    the service-role key, exactly like `official_sources`/`opportunities` —
--    no table in this migration set grants `authenticated` write access
--    unless a student genuinely owns and directly writes the row). The five
--    conversation-shaped tables below ARE written directly by the
--    signed-in student through RLS-narrowed `authenticated` access, so they
--    need the same explicit write grant 0004 gave the student workspace
--    tables.
--
-- 2. Defense in depth: revoke the inherited `anon` SELECT from every AI
--    table that is not meant to be publicly retrievable, so a missing or
--    misconfigured RLS policy can never be the only barrier protecting
--    private conversations or internal/staff-only records. The two
--    source-material tables (`ai_source_documents`, `ai_source_chunks`) are
--    deliberately left off this list — their own RLS policy already narrows
--    `anon` to `status = 'approved'` rows on published opportunities only,
--    and guests retrieving grounded answers is the entire point of the
--    feature.
--
-- 3. Retrieval support: a generated `tsvector` column + GIN index on
--    `ai_source_chunks.chunk_text` is the primary, always-available
--    retrieval mechanism (see `src/lib/ai/rag/retrieval.ts`) — no extension
--    required. An optional `pgvector` embedding column is added on a
--    best-effort basis for a future embeddings provider; Checkpoint 5 ships
--    with only a chat-completion key (`GROQ_API_KEY`), so this column is
--    intentionally unpopulated today and retrieval does not depend on it.
grant select, insert, update, delete on
  ai_conversations,
  ai_messages,
  ai_answer_citations,
  ai_retrieval_events,
  ai_feedback
to authenticated;
--> statement-breakpoint

grant select, insert, update, delete on
  ai_source_documents,
  ai_source_chunks,
  ai_prompt_templates,
  ai_conversations,
  ai_messages,
  ai_answer_citations,
  ai_retrieval_events,
  ai_feedback,
  ai_safety_events,
  ai_evaluation_cases,
  ai_evaluation_runs,
  ai_usage_limits,
  ai_provider_health
to service_role;
--> statement-breakpoint

revoke select on
  ai_conversations,
  ai_messages,
  ai_answer_citations,
  ai_retrieval_events,
  ai_feedback,
  ai_usage_limits,
  ai_prompt_templates,
  ai_evaluation_cases,
  ai_evaluation_runs,
  ai_safety_events,
  ai_provider_health
from anon;
--> statement-breakpoint

alter table ai_source_chunks
  add column if not exists chunk_text_search tsvector generated always as (to_tsvector('english', chunk_text)) stored;
--> statement-breakpoint

create index if not exists ai_source_chunks_text_search_idx on ai_source_chunks using gin (chunk_text_search);
--> statement-breakpoint

create index if not exists ai_source_chunks_status_idx on ai_source_chunks (status);
--> statement-breakpoint

create index if not exists ai_source_chunks_opportunity_idx on ai_source_chunks (opportunity_id);
--> statement-breakpoint

do $$
begin
  create extension if not exists vector;
  execute 'alter table ai_source_chunks add column if not exists embedding vector(1536)';
exception
  when insufficient_privilege then
    raise notice 'pgvector unavailable (insufficient privilege) - embedding column not added; retrieval uses the tsvector full-text fallback only';
  when undefined_file then
    raise notice 'pgvector extension files not installed - embedding column not added; retrieval uses the tsvector full-text fallback only';
  when feature_not_supported then
    -- Stock `postgres:16-alpine` (used by the local db/db-test containers)
    -- raises this SQLSTATE, not undefined_file, when the extension's
    -- control file is simply absent from the image. Supabase-hosted
    -- Postgres ships pgvector already installed, so this branch is a local
    -- Docker/CI reality, not a hypothetical.
    raise notice 'pgvector extension not available on this Postgres instance - embedding column not added; retrieval uses the tsvector full-text fallback only';
end
$$;
