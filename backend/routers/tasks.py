import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from deps import get_db, get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# --- TASK CRUD ---

@router.post("/", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task_data = task_in.model_dump()
    task = models.Task(
        **task_data,
        reporter_id=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.get("/", response_model=List[schemas.TaskResponse])
def list_tasks(
    status_filter: Optional[models.TaskStatus] = None,
    assignee_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Task)
    if status_filter:
        query = query.filter(models.Task.status == status_filter)
    if assignee_id:
        query = query.filter(models.Task.assignee_id == assignee_id)
    return query.offset(skip).limit(limit).all()

@router.get("/{task_id}", response_model=schemas.TaskDetailResponse)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task

@router.patch("/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: uuid.UUID,
    task_in: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = task_in.model_dump(exclude_unset=True)
    
    # Log status change activity automatically
    if "status" in update_data and update_data["status"] != task.status:
        activity = models.TaskActivity(
            task_id=task.id,
            actor_id=current_user.id,
            activity_type=models.ActivityType.STATUS_CHANGE,
            old_value=str(task.status.value),
            new_value=str(update_data["status"].value)
        )
        db.add(activity)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(task)
    db.commit()
    return None


# --- TASK DEPENDENCIES ---

@router.post("/{task_id}/dependencies", response_model=schemas.TaskDependencyResponse, status_code=status.HTTP_201_CREATED)
def add_task_dependency(
    task_id: uuid.UUID,
    dep_in: schemas.TaskDependencyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if task_id == dep_in.depends_on_task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A task cannot depend on itself")
    
    dependency = models.TaskDependency(
        task_id=task_id,
        depends_on_task_id=dep_in.depends_on_task_id,
        dependency_type=dep_in.dependency_type
    )
    db.add(dependency)
    db.commit()
    db.refresh(dependency)
    return dependency


# --- TASK ATTACHMENTS ---

@router.post("/{task_id}/attachments", response_model=schemas.TaskAttachmentResponse, status_code=status.HTTP_201_CREATED)
def add_task_attachment(
    task_id: uuid.UUID,
    attach_in: schemas.TaskAttachmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    uploader_id = attach_in.uploader_id or current_user.id
    attachment = models.TaskAttachment(
        task_id=task_id,
        uploader_id=uploader_id,
        **attach_in.model_dump(exclude={"uploader_id"})
    )
    db.add(attachment)

    # Log activity
    activity = models.TaskActivity(
        task_id=task_id,
        actor_id=current_user.id,
        activity_type=models.ActivityType.ATTACHMENT_ADDED,
        content=f"Added attachment: {attachment.file_name}"
    )
    db.add(activity)

    db.commit()
    db.refresh(attachment)
    return attachment


# --- TASK ACTIVITIES & COMMENTS ---

@router.post("/{task_id}/comments", response_model=schemas.TaskActivityResponse, status_code=status.HTTP_201_CREATED)
def add_task_comment(
    task_id: uuid.UUID,
    comment_text: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    activity = models.TaskActivity(
        task_id=task_id,
        actor_id=current_user.id,
        activity_type=models.ActivityType.COMMENT,
        content=comment_text
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity
