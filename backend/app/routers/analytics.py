import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import (
    Project,
    Task,
    TaskStatus,
    TaskActivity,
    Milestone,
    FileStorage,
    User,
    Message,
)
from app.dependencies import get_current_user
from app.services.notifications import trigger_notification

router = APIRouter(prefix="/analytics", tags=["Insights & Ecosystem"])

# Schemas
class AnalyticsSummarySchema(BaseModel):
    total_tasks: int
    completion_percentage: float
    overdue_count: int
    status_distribution: dict
    priority_distribution: dict

class GlobalSearchItem(BaseModel):
    id: str
    type: str  # task, message, file
    title: str
    subtitle: Optional[str]
    link: str

class MilestoneCreateSchema(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None

class MilestoneResponseSchema(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str]
    due_date: Optional[str]
    is_completed: bool
    created_at: str

class NudgePayload(BaseModel):
    target_user_id: str
    task_id: str
    task_title: str

class AcademicTemplatePayload(BaseModel):
    template_type: str  # CAPSTONE, HACKATHON, RESEARCH

# ============================================================
# AGGREGATION & INSIGHTS
# ============================================================

@router.get("/summary/{project_id}", response_model=AnalyticsSummarySchema)
def get_project_analytics(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    total = len(tasks)
    if total == 0:
        return {
            "total_tasks": 0,
            "completion_percentage": 0.0,
            "overdue_count": 0,
            "status_distribution": {"TODO": 0, "IN_PROGRESS": 0, "IN_REVIEW": 0, "BLOCKED": 0, "DONE": 0},
            "priority_distribution": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
        }

    done_count = sum(1 for t in tasks if t.status == TaskStatus.DONE)
    now = datetime.utcnow()
    overdue_count = sum(1 for t in tasks if t.due_date and t.due_date < now and t.status != TaskStatus.DONE)

    status_dist = {"TODO": 0, "IN_PROGRESS": 0, "IN_REVIEW": 0, "BLOCKED": 0, "DONE": 0}
    for t in tasks:
        val = t.status.value if hasattr(t.status, 'value') else str(t.status)
        status_dist[val] = status_dist.get(val, 0) + 1

    prio_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for t in tasks:
        val = t.priority.value if hasattr(t.priority, 'value') else str(t.priority)
        prio_dist[val] = prio_dist.get(val, 0) + 1

    return {
        "total_tasks": total,
        "completion_percentage": round((done_count / total) * 100, 1),
        "overdue_count": overdue_count,
        "status_distribution": status_dist,
        "priority_distribution": prio_dist,
    }

# ============================================================
# GLOBAL SEARCH
# ============================================================

@router.get("/search", response_model=List[GlobalSearchItem])
def global_search(
    q: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = q.strip().lower()
    if not query:
        return []

    results = []

    # Search Tasks
    tasks = db.query(Task).filter(Task.title.ilike(f"%{query}%")).limit(5).all()
    for t in tasks:
        results.append({
            "id": str(t.id),
            "type": "task",
            "title": t.title,
            "subtitle": f"Status: {t.status.value if hasattr(t.status, 'value') else t.status}",
            "link": "/tasks",
        })

    # Search Chat Messages
    msgs = db.query(Message).filter(Message.content.ilike(f"%{query}%")).limit(5).all()
    for m in msgs:
        results.append({
            "id": str(m.id),
            "type": "message",
            "title": m.content[:50],
            "subtitle": "Project Chat Message",
            "link": "/chat",
        })

    # Search Files
    files = db.query(FileStorage).filter(FileStorage.file_name.ilike(f"%{query}%")).limit(5).all()
    for f in files:
        results.append({
            "id": str(f.id),
            "type": "file",
            "title": f.file_name,
            "subtitle": f"File attachment ({f.file_size or 0} bytes)",
            "link": f.file_url,
        })

    return results

# ============================================================
# MILESTONES
# ============================================================

@router.get("/milestones/{project_id}", response_model=List[MilestoneResponseSchema])
def get_milestones(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ms = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.created_at.asc()).all()
    result = []
    for m in ms:
        result.append({
            "id": str(m.id),
            "project_id": str(m.project_id),
            "title": m.title,
            "description": m.description,
            "due_date": m.due_date.isoformat() if m.due_date else None,
            "is_completed": m.is_completed,
            "created_at": m.created_at.isoformat(),
        })
    return result

@router.post("/milestones/{project_id}", response_model=MilestoneResponseSchema, status_code=status.HTTP_201_CREATED)
def create_milestone(
    project_id: uuid.UUID,
    payload: MilestoneCreateSchema,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    m = Milestone(
        id=uuid.uuid4(),
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        due_date=datetime.fromisoformat(payload.due_date.replace("Z", "+00:00")) if payload.due_date else None,
        is_completed=False,
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    return {
        "id": str(m.id),
        "project_id": str(m.project_id),
        "title": m.title,
        "description": m.description,
        "due_date": m.due_date.isoformat() if m.due_date else None,
        "is_completed": m.is_completed,
        "created_at": m.created_at.isoformat(),
    }

@router.patch("/milestones/{milestone_id}/toggle")
def toggle_milestone(
    milestone_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    m = db.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    m.is_completed = not m.is_completed
    db.commit()
    return {"status": "success", "is_completed": m.is_completed}

# ============================================================
# STUDENT / COLLEGE ELEVATED FEATURES
# ============================================================

@router.post("/nudge")
def send_nudge(
    payload: NudgePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        target_uuid = uuid.UUID(payload.target_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    sender_name = current_user.get("full_name") or current_user.get("username")
    trigger_notification(
        db=db,
        user_id=target_uuid,
        title="Peer Nudge Alert 💬",
        message=f"{sender_name} nudged you on task '{payload.task_title}'. Do you need any help?",
        link_url="/tasks"
    )
    return {"status": "success", "message": f"Nudged user on {payload.task_title}"}

@router.post("/templates/{project_id}")
def apply_academic_template(
    project_id: uuid.UUID,
    payload: AcademicTemplatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    ttype = payload.template_type.upper()
    templates = {
        "CAPSTONE": [
            ("Literature Review & System Spec", "Draft technical requirements and gather reference papers."),
            ("MVP Core Backend Architecture", "Implement FastAPI schemas and database ORM mappings."),
            ("Testing & Peer Code Review", "Run integration tests and finalize security audit."),
            ("Final Presentation & Demo Deck", "Prepare slide deck and live system walkthrough."),
        ],
        "HACKATHON": [
            ("Brainstorming & Pitch Deck", "Define 48-hour scope and elevator pitch."),
            ("Core Prototype Build", "Build frontend UI mockup and API endpoints."),
            ("Live Demo Recording", "Record 2-minute submission video."),
        ],
        "RESEARCH": [
            ("Abstract & Bibliography", "Gather IEEE reference citations."),
            ("Methodology & Benchmark", "Execute experiment scripts and plot chart graphs."),
            ("Final Camera-Ready PDF", "Format LaTeX document for submission."),
        ],
    }

    selected = templates.get(ttype, templates["CAPSTONE"])
    created = []
    for title, desc in selected:
        m = Milestone(
            id=uuid.uuid4(),
            project_id=project_id,
            title=title,
            description=desc,
            is_completed=False,
        )
        db.add(m)
        created.append(title)

    db.commit()
    return {"status": "success", "applied_template": ttype, "milestones_created": created}
