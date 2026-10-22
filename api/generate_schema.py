"""Compile a current PostgreSQL bootstrap for an empty database."""
from pathlib import Path
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from api.models import Base

if __name__=='__main__':
    dialect=postgresql.dialect()
    statements=['-- Current bootstrap: empty PostgreSQL database only. Do not apply incremental migrations 0001/0002 afterwards.','BEGIN;','CREATE TABLE schema_migrations (version VARCHAR(30) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());']
    for table in Base.metadata.sorted_tables:
        statements.append(str(CreateTable(table).compile(dialect=dialect))+';')
        statements.extend(str(CreateIndex(index).compile(dialect=dialect))+';' for index in table.indexes)
    statements.extend(["INSERT INTO plans (id, profile_limit) VALUES ('free', 1), ('premium', 5);","INSERT INTO schema_migrations (version) VALUES ('0001'), ('0002');",'COMMIT;'])
    target=Path('api/migrations/bootstrap_current.sql');target.parent.mkdir(parents=True,exist_ok=True);target.write_text('\n\n'.join(statements));print('Current PostgreSQL bootstrap generated.')
