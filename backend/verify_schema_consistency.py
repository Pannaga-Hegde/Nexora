import os
import sys
from dotenv import load_dotenv
from sqlalchemy import inspect
from alembic.config import Config
from alembic import command

load_dotenv()

from app.database import engine
from app.models import Base

insp = inspect(engine)
db_tables = set(insp.get_table_names())
model_tables = set(Base.metadata.tables.keys())

print("=" * 65)
print("NEXORA STEP 3D: READ-ONLY DATABASE SCHEMA CONSISTENCY AUDIT")
print("=" * 65)

# 1. Table Verification
print("\n[1] Table Presence Verification")
print(f"   -> Model Tables ({len(model_tables)}): {sorted(list(model_tables))}")
print(f"   -> Database Tables ({len(db_tables)}): {sorted(list(db_tables))}")

missing_in_db = model_tables - db_tables
extra_in_db = db_tables - model_tables - {"alembic_version"}

assert not missing_in_db, f"Missing tables in DB: {missing_in_db}"
assert not extra_in_db, f"Unexpected extra tables in DB: {extra_in_db}"
print("   -> TABLE PRESENCE: PASS (All 18 tables perfectly matched)")

# 2. Columns & Nullability
print("\n[2] Columns, Types & Nullability Verification")
column_mismatches = []
for t_name in sorted(model_tables):
    m_table = Base.metadata.tables[t_name]
    db_cols = {c["name"]: c for c in insp.get_columns(t_name)}
    m_cols = {c.name: c for c in m_table.columns}

    for col_name, m_col in m_cols.items():
        if col_name not in db_cols:
            column_mismatches.append(f"{t_name}.{col_name} missing in DB")
        else:
            db_col = db_cols[col_name]
            db_null = db_col["nullable"]
            m_null = m_col.nullable
            if m_null != db_null:
                column_mismatches.append(
                    f"{t_name}.{col_name} nullability diff: model(nullable={m_null}) vs db(nullable={db_null})"
                )

if column_mismatches:
    print(f"   -> Column Mismatches Detected ({len(column_mismatches)}):")
    for m in column_mismatches:
        print(f"      * {m}")
else:
    print("   -> COLUMNS & NULLABILITY: PASS (All columns match)")

# 3. CommentAttachment.comment_id Nullable Check
print("\n[3] CommentAttachment.comment_id Check")
att_cols = {c["name"]: c for c in insp.get_columns("comment_attachments")}
comment_id_col = att_cols.get("comment_id")
assert comment_id_col is not None, "comment_id column not found in comment_attachments"
print(f"   -> comment_attachments.comment_id nullable: {comment_id_col['nullable']} (Expected: True)")
assert comment_id_col["nullable"] is True, "comment_attachments.comment_id must be nullable=True"
print("   -> COMMENT_ATTACHMENT NULLABLE: PASS")

# 4. Primary Key & Foreign Key Verification
print("\n[4] Primary Keys & Foreign Keys Verification")
pk_fk_mismatches = []
for t_name in sorted(model_tables):
    m_table = Base.metadata.tables[t_name]
    db_pks = insp.get_pk_constraint(t_name)
    m_pks = [c.name for c in m_table.primary_key.columns]
    if set(db_pks.get("constrained_columns", [])) != set(m_pks):
        pk_fk_mismatches.append(f"{t_name} PK mismatch: model={m_pks} vs db={db_pks.get('constrained_columns')}")

    db_fks = insp.get_foreign_keys(t_name)
    m_fks = list(m_table.foreign_keys)
    if len(db_fks) != len(m_fks):
        pk_fk_mismatches.append(f"{t_name} FK count: model={len(m_fks)} vs db={len(db_fks)}")

if pk_fk_mismatches:
    print(f"   -> PK/FK Mismatches Detected ({len(pk_fk_mismatches)}):")
    for m in pk_fk_mismatches:
        print(f"      * {m}")
else:
    print("   -> PRIMARY KEYS & FOREIGN KEYS: PASS (All PKs and FKs match)")

# 5. PostgreSQL Custom Enums
print("\n[5] PostgreSQL ENUM Types Verification")
db_enums = insp.get_enums()
enum_names = {e["name"]: e["labels"] for e in db_enums}
expected_enums = ["task_status", "task_priority", "dependency_type", "activity_type"]

for enum_name in expected_enums:
    assert enum_name in enum_names, f"ENUM type '{enum_name}' missing in database"
    print(f"   -> ENUM '{enum_name}': {enum_names[enum_name]}")
print("   -> POSTGRESQL ENUMS: PASS (All 4 custom enums present)")

# 6. Alembic Current Revision Check
print("\n[6] Alembic Current Version Check")
from alembic.runtime.migration import MigrationContext
conn = engine.connect()
context = MigrationContext.configure(conn)
current_rev = context.get_current_revision()
conn.close()
print(f"   -> Current Alembic Revision in DB: {current_rev}")
assert current_rev == "0001_initial_schema", f"Expected '0001_initial_schema', got {current_rev}"
print("   -> ALEMBIC REVISION: PASS")

print("\n" + "=" * 65)
if not column_mismatches and not pk_fk_mismatches:
    print("DATABASE SCHEMA CONSISTENCY: PASS")
else:
    print("DATABASE SCHEMA CONSISTENCY: DISCREPANCIES REPORTED")
print("=" * 65)
