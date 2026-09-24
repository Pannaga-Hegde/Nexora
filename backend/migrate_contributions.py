from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    new_values = [
        'TASK_CREATED', 'TASK_COMPLETED', 'TASK_REOPENED', 'TASK_ASSIGNED',
        'COMMENT_CREATED', 'REPLY_CREATED', 'MILESTONE_COMPLETED',
        'FILE_UPLOADED', 'MESSAGE_SENT'
    ]
    for v in new_values:
        try:
            conn.execute(text(f"ALTER TYPE activity_type ADD VALUE IF NOT EXISTS '{v}'"))
            conn.commit()
            print(f"Added enum value: {v}")
        except Exception as e:
            print(f"Skip {v}: {e}")
            conn.rollback()

    # Add project_id column
    try:
        conn.execute(text("ALTER TABLE task_activities ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE"))
        conn.commit()
        print("Added project_id column to task_activities")
    except Exception as e:
        print(f"project_id col: {e}")
        conn.rollback()

    # Add indexes
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_activities_project_id ON task_activities(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_activities_actor_id ON task_activities(actor_id)",
        "CREATE INDEX IF NOT EXISTS idx_activities_created_at ON task_activities(created_at)",
    ]
    for idx_sql in indexes:
        try:
            conn.execute(text(idx_sql))
            conn.commit()
            print(f"Index created")
        except Exception as e:
            print(f"Index skip: {e}")
            conn.rollback()

print("Migration complete")
