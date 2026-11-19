-- Rules the database enforces on its own (docs/04 section 4) and the generated
-- full-text search column (ADR-015). Prisma cannot express CHECK constraints or
-- generated columns, so they live in this hand-written migration.

-- Reference numbers: CC-<year>-<sequence>
CREATE SEQUENCE IF NOT EXISTS complaint_ref_seq;

-- Users: department admins belong to exactly one department, nobody else does.
ALTER TABLE "user"
  ADD CONSTRAINT user_department_matches_role CHECK (
    (role = 'DEPT_ADMIN' AND department_id IS NOT NULL) OR (role <> 'DEPT_ADMIN' AND department_id IS NULL)
  );

-- Complaints
ALTER TABLE complaint
  ADD CONSTRAINT complaint_title_length CHECK (char_length(title) BETWEEN 5 AND 120),
  ADD CONSTRAINT complaint_description_length CHECK (char_length(description) BETWEEN 20 AND 5000),
  ADD CONSTRAINT complaint_rejection_needs_reason CHECK (
    status <> 'REJECTED' OR char_length(btrim(coalesce(rejection_reason, ''))) >= 10
  ),
  ADD CONSTRAINT complaint_resolution_needs_note CHECK (
    status <> 'RESOLVED' OR char_length(btrim(coalesce(resolution_note, ''))) >= 10
  ),
  ADD CONSTRAINT complaint_rating_range CHECK (satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT complaint_rating_only_when_resolved CHECK (satisfaction_rating IS NULL OR status = 'RESOLVED'),
  ADD CONSTRAINT complaint_support_count_positive CHECK (support_count >= 0),
  ADD CONSTRAINT complaint_version_positive CHECK (version >= 1);

ALTER TABLE complaint_comment
  ADD CONSTRAINT complaint_comment_length CHECK (char_length(body) BETWEEN 1 AND 2000);

-- Replace the plain column from the init migration with a generated one.
DROP INDEX IF EXISTS complaint_search_idx;
ALTER TABLE complaint DROP COLUMN IF EXISTS search_vector;
ALTER TABLE complaint ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(reference_no, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX complaint_search_idx ON complaint USING GIN (search_vector);
