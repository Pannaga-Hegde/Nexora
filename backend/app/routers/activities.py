import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import Task, TaskActivity, ActivityType, Project
from app.dependencies import get_current_user, verify_project_membership

router = APIRouter(
    prefix="/projects/{project_id}/tasks/{task_id}/activities",
    tags=["Task Activities & Comments"],
)

MAX_ACTIVITY_COMMENT_LENGTH = 10000

class ActivityCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_ACTIVITY_COMMENT_LENGTH)

class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    actor_id: Optional[uuid.UUID]
    activity_type: ActivityType
    content: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: str

@router.get("", response_model=List[ActivityResponse])
def get_task_activities(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = current_user["id"] if isinstance(current_user["id"], uuid.UUID) else uuid.UUID(str(current_user["id"]))
    verify_project_membership(db, project_id, user_id)

    task = db.scalar(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    activities = (
        db.query(TaskActivity)
        .filter(TaskActivity.task_id == task_id)
        .order_by(TaskActivity.created_at.asc())
        .all()
    )
    
    formatted = []
    for act in activities:
        formatted.append({
            "id": act.id,
            "task_id": act.task_id,
            "actor_id": act.actor_id,
            "activity_type": act.activity_type,
            "content": act.content,
            "old_value": act.old_value,
            "new_value": act.new_value,
            "created_at": act.created_at.isoformat(),
        })
    return formatted

@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def add_task_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    activity_in: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = current_user["id"] if isinstance(current_user["id"], uuid.UUID) else uuid.UUID(str(current_user["id"]))
    verify_project_membership(db, project_id, user_id)

    task = db.scalar(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    act = TaskActivity(
        id=uuid.uuid4(),
        task_id=task_id,
        actor_id=user_id,
        activity_type=ActivityType.COMMENT,
        content=activity_in.content,
    )
    db.add(act)
    db.commit()
    db.refresh(act)

    return {
        "id": act.id,
        "task_id": act.task_id,
        "actor_id": act.actor_id,
        "activity_type": act.activity_type,
        "content": act.content,
        "old_value": act.old_value,
        "new_value": act.new_value,
        "created_at": act.created_at.isoformat(),
    }
