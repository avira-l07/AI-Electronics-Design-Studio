-- Existing PostgreSQL installations: back up, then apply once after 0001.
BEGIN;
ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN trashed BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE project_shares (
 id VARCHAR(36) PRIMARY KEY,
 project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 snapshot TEXT NOT NULL,
 expires INTEGER NOT NULL,
 revoked BOOLEAN NOT NULL
);
CREATE INDEX ix_project_shares_project_id ON project_shares(project_id);
INSERT INTO schema_migrations(version) VALUES ('0002');
COMMIT;
