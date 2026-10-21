"""Compile the initial PostgreSQL migration for operator review."""
from pathlib import Path
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from api.models import Base

if __name__=='__main__':
    dialect=postgresql.dialect()
    statements=['-- Initial schema: apply once to an empty PostgreSQL database.','BEGIN;','CREATE TABLE schema_migrations (version VARCHAR(30) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());']
    for table in Base.metadata.sorted_tables:
        statements.append(str(CreateTable(table).compile(dialect=dialect))+';')
        statements.extend(str(CreateIndex(index).compile(dialect=dialect))+';' for index in table.indexes)
    statements.extend(["INSERT INTO plans (id, profile_limit) VALUES ('free', 1), ('premium', 5);","INSERT INTO schema_migrations (version) VALUES ('0001');",'COMMIT;'])
    target=Path('api/migrations/0001_initial.sql');target.parent.mkdir(parents=True,exist_ok=True);target.write_text('\n\n'.join(statements));print('Initial PostgreSQL migration generated.')
