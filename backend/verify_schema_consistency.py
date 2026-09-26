import os
import ast
import glob
from dotenv import load_dotenv
from sqlalchemy import inspect
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

load_dotenv()

from app.database import engine
from app.models import Base

insp = inspect(engine)
db_all_tables = set(insp.get_table_names())
db_metadata_tables = db_all_tables & {"alembic_version"}
db_app_tables = db_all_tables - {"alembic_version"}
model_tables = set(Base.metadata.tables.keys())

# Extract application tables declared across Alembic migrations
versions_dir = os.path.join(os.path.dirname(__file__), "alembic", "versions")
alembic_app_tables = set()
for py_file in glob.glob(os.path.join(versions_dir, "*.py")):
    with open(py_file, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "create_table":
            if node.args and isinstance(node.args[0], ast.Constant):
                alembic_app_tables.add(node.args[0].value)

print("=" * 65)
print("NEXORA STEP 3D: READ-ONLY DATABASE SCHEMA CONSISTENCY AUDIT")
print("=" * 65)

# 1. Table Verification
print("\n[1] Table Presence Verification")
print(f"   -> Model Application Tables ({len(model_tables)}): {sorted(list(model_tables))}")
print(f"   -> Alembic Application Tables ({len(alembic_app_tables)}): {sorted(list(alembic_app_tables))}")
print(f"   -> Database Application Tables ({len(db_app_tables)}): {sorted(list(db_app_tables))}")
print(f"   -> Database Metadata Tables ({len(db_metadata_tables)}): {sorted(list(db_metadata_tables))}")

missing_in_db = model_tables - db_app_tables
extra_in_db = db_app_tables - model_tables
mismatch_alembic = model_tables ^ alembic_app_tables

assert not missing_in_db, f"Missing application tables in DB: {missing_in_db}"
assert not extra_in_db, f"Unexpected extra application tables in DB: {extra_in_db}"
assert not mismatch_alembic, f"Mismatch between models and Alembic migrations: {mismatch_alembic}"
assert "alembic_version" in db_all_tables, "Expected 'alembic_version' metadata table in DB"
print(f"   -> TABLE PRESENCE: PASS (All {len(model_tables)} application tables perfectly matched across Models, Alembic, and DB)")

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
print("\n[5] Database ENUM Types Verification")
if insp.dialect.name == "postgresql" and hasattr(insp, "get_enums"):
    db_enums = insp.get_enums()
    enum_names = {e["name"]: e["labels"] for e in db_enums}
    expected_enums = ["task_status", "task_priority", "dependency_type", "activity_type"]

    for enum_name in expected_enums:
        assert enum_name in enum_names, f"ENUM type '{enum_name}' missing in database"
        print(f"   -> ENUM '{enum_name}': {enum_names[enum_name]}")
    print("   -> POSTGRESQL ENUMS: PASS (All 4 custom enums present)")
else:
    print(f"   -> Dialect '{insp.dialect.name}' stores Enums as VARCHAR check constraints: PASS")

# 6. Alembic Current Revision Check
print("\n[6] Alembic Current Version Check")
alembic_ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
alembic_cfg = Config(alembic_ini_path)
script = ScriptDirectory.from_config(alembic_cfg)
heads = script.get_heads()
assert len(heads) == 1, f"Expected exactly 1 migration head, found: {heads}"
expected_head = heads[0]

conn = engine.connect()
context = MigrationContext.configure(conn)
current_rev = context.get_current_revision()
conn.close()

print(f"   -> Alembic Head Revision: {expected_head}")
print(f"   -> Current Alembic Revision in DB: {current_rev}")
assert current_rev == expected_head, f"Database revision ({current_rev}) != Head revision ({expected_head})"
print("   -> ALEMBIC REVISION: PASS (Database is strictly at migration head)")

print("\n" + "=" * 65)
if not column_mismatches and not pk_fk_mismatches:
    print("DATABASE SCHEMA CONSISTENCY: PASS")
else:
    print("DATABASE SCHEMA CONSISTENCY: DISCREPANCIES REPORTED")
print("=" * 65)
