import uuid
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import (
    Project,
    ProjectMember,
    Task,
    TaskActivity,
    ActivityType,
    TaskStatus,
    TaskDependency,
    Milestone,
)
from ..services.risk_engine import evaluate_task_risk
from ..schemas import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)


router = APIRouter(
    prefix="/projects/{project_id}/tasks",
    tags=["Tasks"],
)


def verify_project_membership(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session,
):
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this project",
        )

    return membership


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    project_id: uuid.UUID,
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    if task_data.assignee_id is not None:
        assignee_membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == task_data.assignee_id,
            )
        )
        if not assignee_membership:
            raise HTTPException(
                status_code=400,
                detail="Assignee must be a member of this project",
            )

    task = Task(
        project_id=project_id,
        title=task_data.title,
        description=task_data.description,
        status=task_data.status,
        priority=task_data.priority,
        reporter_id=current_user["id"],
        assignee_id=task_data.assignee_id,
        due_date=task_data.due_date,
    )

    db.add(task)
    db.flush()  # get task.id before commit

    # Record contribution activity: TASK_CREATED
    db.add(TaskActivity(
        task_id=task.id,
        project_id=project_id,
        actor_id=current_user["id"],
        activity_type=ActivityType.TASK_CREATED,
        content=task_data.title,
    ))

    # Record TASK_ASSIGNED if assigned on creation
    if task_data.assignee_id:
        db.add(TaskActivity(
            task_id=task.id,
            project_id=project_id,
            actor_id=current_user["id"],
            activity_type=ActivityType.TASK_ASSIGNED,
            new_value=str(task_data.assignee_id),
        ))

    db.commit()
    db.refresh(task)

    return task


@router.get(
    "",
    response_model=List[TaskResponse],
)
def get_project_tasks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    statement = (
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
    )

    return db.scalars(statement).all()


@router.get(
    "/risks/batch",
)
def get_all_tasks_risks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    if not tasks:
        return {}

    task_ids = [t.id for t in tasks]
    task_by_id = {t.id: t for t in tasks}

    deps = db.query(TaskDependency).filter(TaskDependency.task_id.in_(task_ids)).all()
    blocked_by_map = {t.id: [] for t in tasks}
    for dep in deps:
        if dep.depends_on_task_id in task_by_id:
            parent = task_by_id[dep.depends_on_task_id]
            blocked_by_map[dep.task_id].append({
                "id": str(parent.id),
                "title": parent.title,
                "status": parent.status.value if hasattr(parent.status, "value") else str(parent.status),
                "is_completed": parent.status == TaskStatus.DONE,
            })

    from sqlalchemy import func
    latest_activities = (
        db.query(TaskActivity.task_id, func.max(TaskActivity.created_at).label("latest_at"))
        .filter(TaskActivity.task_id.in_(task_ids))
        .group_by(TaskActivity.task_id)
        .all()
    )
    latest_activity_map = {t_id: l_at for t_id, l_at in latest_activities if t_id}

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()
    milestone_map = {m.id: m for m in milestones}

    results = {}
    for task in tasks:
        m = milestone_map.get(task.milestone_id) if task.milestone_id else None
        risk_result = evaluate_task_risk(
            task=task,
            blocked_by=blocked_by_map.get(task.id, []),
            latest_activity_dt=latest_activity_map.get(task.id),
            milestone=m,
        )
        results[str(task.id)] = risk_result

    return results


@router.get(
    "/{task_id}/risk",
)
def get_task_risk(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
        )
    )
    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    # Fetch dependencies
    deps = db.query(TaskDependency).filter(TaskDependency.task_id == task.id).all()
    blocked_by = []
    for dep in deps:
        parent = db.get(Task, dep.depends_on_task_id)
        if parent:
            blocked_by.append({
                "id": str(parent.id),
                "title": parent.title,
                "status": parent.status.value if hasattr(parent.status, "value") else str(parent.status),
                "is_completed": parent.status == TaskStatus.DONE,
            })

    # Fetch latest activity
    latest_act = (
        db.query(TaskActivity.created_at)
        .filter(TaskActivity.task_id == task.id)
        .order_by(TaskActivity.created_at.desc())
        .first()
    )
    latest_act_dt = latest_act[0] if latest_act else None

    # Fetch milestone
    milestone = db.get(Milestone, task.milestone_id) if task.milestone_id else None

    risk_result = evaluate_task_risk(
        task=task,
        blocked_by=blocked_by,
        latest_activity_dt=latest_act_dt,
        milestone=milestone,
    )

    return {
        "task_id": str(task.id),
        "task_title": task.title,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "status": task.status.value if hasattr(task.status, "value") else str(task.status),
        "risk": risk_result,
    }


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
        )
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
        )
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if task_data.assignee_id is not None:
        assignee_membership = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == task_data.assignee_id,
            )
        )
        if not assignee_membership:
            raise HTTPException(
                status_code=400,
                detail="Assignee must be a member of this project",
            )

    old_status = task.status
    old_assignee = task.assignee_id
    update_data = task_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(task, field, value)

    # Record contribution activities for meaningful changes
    new_status = task.status
    new_assignee = task.assignee_id

    if old_status != new_status:
        if new_status == TaskStatus.DONE:
            db.add(TaskActivity(
                task_id=task.id,
                project_id=project_id,
                actor_id=current_user["id"],
                activity_type=ActivityType.TASK_COMPLETED,
                old_value=str(old_status.value if hasattr(old_status, 'value') else old_status),
                new_value="DONE",
                content=task.title,
            ))
        elif old_status == TaskStatus.DONE:
            db.add(TaskActivity(
                task_id=task.id,
                project_id=project_id,
                actor_id=current_user["id"],
                activity_type=ActivityType.TASK_REOPENED,
                old_value="DONE",
                new_value=str(new_status.value if hasattr(new_status, 'value') else new_status),
                content=task.title,
            ))
        else:
            db.add(TaskActivity(
                task_id=task.id,
                project_id=project_id,
                actor_id=current_user["id"],
                activity_type=ActivityType.STATUS_CHANGE,
                old_value=str(old_status.value if hasattr(old_status, 'value') else old_status),
                new_value=str(new_status.value if hasattr(new_status, 'value') else new_status),
            ))

    if old_assignee != new_assignee and new_assignee is not None:
        db.add(TaskActivity(
            task_id=task.id,
            project_id=project_id,
            actor_id=current_user["id"],
            activity_type=ActivityType.TASK_ASSIGNED,
            old_value=str(old_assignee) if old_assignee else None,
            new_value=str(new_assignee),
        ))

    db.commit()
    db.refresh(task)

    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    verify_project_membership(
        project_id=project_id,
        user_id=current_user["id"],
        db=db,
    )

    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.project_id == project_id,
        )
    )

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return None
