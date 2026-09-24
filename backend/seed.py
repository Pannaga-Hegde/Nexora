"""
Standalone Development Seed Script for Nexora
Populates sample team members, projects, and initial Kanban tasks for local testing.

Usage:
    python seed.py
"""
import os
import sys
import uuid
from dotenv import load_dotenv

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Task, TaskStatus, TaskPriority
from app.auth import get_password_hash

PROJ_1_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
PROJ_2_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

TEAM_MEMBERS = [
    (uuid.UUID("00000000-0000-0000-0000-000000000001"), "yathin_n", "yathin@example.com", "Yathin N (Lead)"),
    (uuid.UUID("00000000-0000-0000-0000-000000000002"), "madhuri_g", "madhuri@example.com", "Madhuri G"),
    (uuid.UUID("00000000-0000-0000-0000-000000000003"), "bhuvan_p", "bhuvan@example.com", "Bhuvan Patil"),
    (uuid.UUID("00000000-0000-0000-0000-000000000004"), "sanchita_s", "sanchita@example.com", "Sanchita S R"),
    (uuid.UUID("00000000-0000-0000-0000-000000000005"), "gnana_s", "gnana@example.com", "Gnana Sagar"),
]


def seed():
    print("Seeding development data into database...")
    db = SessionLocal()
    try:
        dev_hash = get_password_hash("password123")
        for u_id, u_name, u_email, u_fullname in TEAM_MEMBERS:
            u = db.get(User, u_id)
            if not u:
                u = User(
                    id=u_id,
                    username=u_name,
                    email=u_email,
                    full_name=u_fullname,
                    password_hash=dev_hash,
                    system_role="student",
                )
                db.add(u)
            elif u.password_hash == "mockhash" or not u.password_hash.startswith("$2b$"):
                u.password_hash = dev_hash
        db.commit()

        proj1 = db.get(Project, PROJ_1_ID)
        if not proj1:
            proj1 = Project(
                id=PROJ_1_ID,
                name="Phoenix Redesign",
                description="Full UI/UX overhaul of the customer-facing dashboard.",
                status="Active",
            )
            db.add(proj1)
            db.commit()

        proj2 = db.get(Project, PROJ_2_ID)
        if not proj2:
            proj2 = Project(
                id=PROJ_2_ID,
                name="Mobile App Launch",
                description="Cross-platform mobile client for iOS and Android.",
                status="Planning",
            )
            db.add(proj2)
            db.commit()

        for u_id, _, _, _ in TEAM_MEMBERS:
            mem1 = db.get(ProjectMember, (PROJ_1_ID, u_id))
            if not mem1:
                db.add(ProjectMember(project_id=PROJ_1_ID, user_id=u_id, project_role="member"))

            mem2 = db.get(ProjectMember, (PROJ_2_ID, u_id))
            if not mem2:
                db.add(ProjectMember(project_id=PROJ_2_ID, user_id=u_id, project_role="member"))

        db.commit()

        existing_tasks = db.query(Task).filter(Task.project_id == PROJ_1_ID).all()
        if not existing_tasks:
            lead_id = TEAM_MEMBERS[0][0]
            tasks_data = [
                Task(
                    title="Migrate auth endpoints to OAuth2 password flow",
                    description="Replace legacy token handler in FastAPI.",
                    status=TaskStatus.IN_PROGRESS,
                    priority=TaskPriority.CRITICAL,
                    project_id=PROJ_1_ID,
                    reporter_id=lead_id,
                    assignee_id=lead_id,
                ),
                Task(
                    title="Design empty states for the Kanban board",
                    description="Cover no tasks, no project selected, and filtered states.",
                    status=TaskStatus.TODO,
                    priority=TaskPriority.MEDIUM,
                    project_id=PROJ_1_ID,
                    reporter_id=lead_id,
                    assignee_id=lead_id,
                ),
                Task(
                    title="Postgres connection pool exhausting under load",
                    description="Staging drops connections above ~40 concurrent users.",
                    status=TaskStatus.BLOCKED,
                    priority=TaskPriority.CRITICAL,
                    project_id=PROJ_1_ID,
                    reporter_id=lead_id,
                    assignee_id=lead_id,
                ),
                Task(
                    title="Add optimistic updates to task drag-and-drop",
                    status=TaskStatus.IN_REVIEW,
                    priority=TaskPriority.HIGH,
                    project_id=PROJ_1_ID,
                    reporter_id=lead_id,
                    assignee_id=lead_id,
                ),
                Task(
                    title="Set up Sentry error tracking in Vite build",
                    status=TaskStatus.DONE,
                    priority=TaskPriority.MEDIUM,
                    project_id=PROJ_1_ID,
                    reporter_id=lead_id,
                    assignee_id=lead_id,
                ),
            ]
            db.add_all(tasks_data)
            db.commit()

        print("Development data seeded successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
