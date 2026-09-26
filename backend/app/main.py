import os
import uuid
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

# Load environment variables early
load_dotenv()

from app.database import engine, Base, SessionLocal
from app.models import User, Project, ProjectMember, Task, TaskStatus, TaskPriority
from app.auth import get_password_hash, decode_access_token, COOKIE_NAME
from app.routers import (
    users,
    projects,
    tasks,
    auth,
    activities,
    community,
    chat,
    workflow,
    analytics,
    reports,
    scheduling,
    task_discussion,
    contributions,
    health,
)
from app.websockets import manager

# Note: Production schema management is handled via Alembic migrations ('alembic upgrade head').
# Base.metadata.create_all is removed from production application startup.

PROJ_1_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
PROJ_2_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

TEAM_MEMBERS = [
    (uuid.UUID("00000000-0000-0000-0000-000000000001"), "yathin_n", "yathin@example.com", "Yathin N (Lead)"),
    (uuid.UUID("00000000-0000-0000-0000-000000000002"), "madhuri_g", "madhuri@example.com", "Madhuri G"),
    (uuid.UUID("00000000-0000-0000-0000-000000000003"), "bhuvan_p", "bhuvan@example.com", "Bhuvan Patil"),
    (uuid.UUID("00000000-0000-0000-0000-000000000004"), "sanchita_s", "sanchita@example.com", "Sanchita S R"),
    (uuid.UUID("00000000-0000-0000-0000-000000000005"), "gnana_s", "gnana@example.com", "Gnana Sagar"),
]

def seed_database():
    db: Session = SessionLocal()
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
    finally:
        db.close()


# Development-only seeding: Run 'python seed.py' or set SEED_DEV_DATA=true explicitly
if os.getenv("SEED_DEV_DATA", "false").lower() in ("true", "1", "yes"):
    seed_database()

from app.services.mfa_service import validate_mfa_configuration
validate_mfa_configuration()

app = FastAPI(title="Nexora API", version="1.0.0")

# Configurable CORS Origins
cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

# Include FRONTEND_URL in allowed origins if configured
frontend_url_env = os.getenv("FRONTEND_URL")
if frontend_url_env and frontend_url_env.strip():
    cleaned_fe = frontend_url_env.strip().rstrip("/")
    if cleaned_fe not in allowed_origins:
        allowed_origins.append(cleaned_fe)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Nexora API is running", "version": "1.0.0"}


@app.get("/health", tags=["System"])
def health_check(response: Response):
    """
    Minimal safe system health check suitable for container health checks.
    Pings the database without exposing sensitive credentials or internal configuration.
    """
    try:
        with SessionLocal() as db:
            db.execute(select(1))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unhealthy", "database": "disconnected"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(activities.router)
app.include_router(community.router)
app.include_router(chat.router)
app.include_router(workflow.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(scheduling.router)
app.include_router(task_discussion.router)
app.include_router(contributions.router)
app.include_router(health.router)


@app.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    # 1. Parse and validate project UUID format
    try:
        proj_uuid = uuid.UUID(project_id)
    except ValueError:
        await websocket.close(code=4403)
        return

    # 2. Extract and validate JWT token exclusively from secure HttpOnly cookie
    token = websocket.cookies.get(COOKIE_NAME)
    if not token:
        await websocket.close(code=4401)
        return

    payload = decode_access_token(token)
    if not payload or payload.get("mfa_pending"):
        await websocket.close(code=4401)
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=4401)
        return

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        await websocket.close(code=4401)
        return

    # 3. Resolve user and verify project membership
    with SessionLocal() as db:
        user = db.get(User, user_uuid)
        if not user:
            await websocket.close(code=4401)
            return

        membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == proj_uuid,
                ProjectMember.user_id == user_uuid,
            )
        )
        if not membership:
            await websocket.close(code=4403)
            return

    # 4. Authenticated & Authorized: accept connection and delegate to manager
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(project_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)

