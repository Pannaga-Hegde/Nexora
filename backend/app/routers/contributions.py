"""
Contribution System Router
Provides project-level contribution aggregation derived entirely from actual database records.
No scores, no rankings — only verified activity counts and timelines.
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ActivityType,
    FileStorage,
    Milestone,
    Project,
    ProjectMember,
    Task,
    TaskActivity,
    TaskComment,
    TaskStatus,
    User,
)
from app.dependencies import get_current_user

router = APIRouter(prefix="/projects/{project_id}/contributions", tags=["Contributions"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _verify_membership(db: Session, project_id: uuid.UUID, user_id: uuid.UUID):
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this project")
    return membership


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return None


def _activity_label(activity_type: str) -> str:
    labels = {
        "TASK_CREATED": "Created task",
        "TASK_COMPLETED": "Completed task",
        "TASK_REOPENED": "Reopened task",
        "TASK_ASSIGNED": "Assigned to task",
        "COMMENT_CREATED": "Commented on task",
        "REPLY_CREATED": "Replied in discussion",
        "STATUS_CHANGE": "Updated task status",
        "MILESTONE_COMPLETED": "Completed milestone",
        "FILE_UPLOADED": "Uploaded file",
        "MESSAGE_SENT": "Sent message",
        "COMMENT": "Commented",
        "ASSIGNMENT": "Task assigned",
        "ATTACHMENT_ADDED": "Added attachment",
    }
    return labels.get(activity_type, activity_type.replace("_", " ").title())


def _activity_icon(activity_type: str) -> str:
    icons = {
        "TASK_CREATED": "plus",
        "TASK_COMPLETED": "check",
        "TASK_REOPENED": "refresh",
        "TASK_ASSIGNED": "user",
        "COMMENT_CREATED": "message",
        "REPLY_CREATED": "reply",
        "STATUS_CHANGE": "edit",
        "MILESTONE_COMPLETED": "flag",
        "FILE_UPLOADED": "paperclip",
        "MESSAGE_SENT": "chat",
        "COMMENT": "message",
        "ASSIGNMENT": "user",
        "ATTACHMENT_ADDED": "paperclip",
    }
    return icons.get(activity_type, "activity")


def _get_member_stats(
    db: Session,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    start_dt: Optional[datetime] = None,
    end_dt: Optional[datetime] = None,
    milestone_id: Optional[uuid.UUID] = None,
) -> dict:
    """Aggregate contribution stats for a single member from actual records."""

    # ── Tasks ──────────────────────────────────────────────────────────────
    task_q = db.query(Task).filter(
        Task.project_id == project_id,
        Task.assignee_id == user_id,
    )
    if milestone_id:
        task_q = task_q.filter(Task.milestone_id == milestone_id)

    all_tasks = task_q.all()

    # Apply date filter to completed tasks via activities, not task dates
    # (tasks don't have a completion_date field, so we use the activity record)
    completed_task_ids_q = db.query(TaskActivity.task_id).filter(
        TaskActivity.project_id == project_id,
        TaskActivity.actor_id == user_id,
        TaskActivity.activity_type == ActivityType.TASK_COMPLETED,
    )
    if start_dt:
        completed_task_ids_q = completed_task_ids_q.filter(TaskActivity.created_at >= start_dt)
    if end_dt:
        completed_task_ids_q = completed_task_ids_q.filter(TaskActivity.created_at <= end_dt)

    completed_task_ids = {row[0] for row in completed_task_ids_q.all()}

    tasks_assigned = len(all_tasks)
    tasks_completed = sum(1 for t in all_tasks if t.status == TaskStatus.DONE)
    tasks_overdue = sum(
        1 for t in all_tasks
        if t.due_date and t.due_date.replace(tzinfo=None) < datetime.utcnow() and t.status != TaskStatus.DONE
    )

    # Completed tasks list (actual records)
    completed_tasks = [
        {
            "id": str(t.id),
            "title": t.title,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
            "milestone_id": str(t.milestone_id) if t.milestone_id else None,
        }
        for t in all_tasks if t.status == TaskStatus.DONE
    ]

    # ── Discussions ─────────────────────────────────────────────────────────
    comment_q = db.query(TaskComment).join(Task, Task.id == TaskComment.task_id).filter(
        Task.project_id == project_id,
        TaskComment.author_id == user_id,
        TaskComment.parent_comment_id.is_(None),
    )
    reply_q = db.query(TaskComment).join(Task, Task.id == TaskComment.task_id).filter(
        Task.project_id == project_id,
        TaskComment.author_id == user_id,
        TaskComment.parent_comment_id.isnot(None),
    )
    if start_dt:
        comment_q = comment_q.filter(TaskComment.created_at >= start_dt)
        reply_q = reply_q.filter(TaskComment.created_at >= start_dt)
    if end_dt:
        comment_q = comment_q.filter(TaskComment.created_at <= end_dt)
        reply_q = reply_q.filter(TaskComment.created_at <= end_dt)

    comments_count = comment_q.count()
    replies_count = reply_q.count()

    # ── Milestones ─────────────────────────────────────────────────────────
    # Milestones the member contributed to via completed tasks
    milestone_ids = set()
    for t in all_tasks:
        if t.status == TaskStatus.DONE and t.milestone_id:
            milestone_ids.add(t.milestone_id)

    milestones_list = []
    if milestone_ids:
        ms_records = db.query(Milestone).filter(Milestone.id.in_(list(milestone_ids))).all()
        milestones_list = [
            {"id": str(m.id), "title": m.title, "is_completed": m.is_completed}
            for m in ms_records
        ]

    # ── Files ───────────────────────────────────────────────────────────────
    file_q = db.query(FileStorage).filter(
        FileStorage.project_id == project_id,
        FileStorage.uploader_id == user_id,
    )
    if start_dt:
        file_q = file_q.filter(FileStorage.created_at >= start_dt)
    if end_dt:
        file_q = file_q.filter(FileStorage.created_at <= end_dt)
    files_count = file_q.count()

    # ── Activity total ──────────────────────────────────────────────────────
    act_q = db.query(TaskActivity).filter(
        TaskActivity.project_id == project_id,
        TaskActivity.actor_id == user_id,
    )
    if start_dt:
        act_q = act_q.filter(TaskActivity.created_at >= start_dt)
    if end_dt:
        act_q = act_q.filter(TaskActivity.created_at <= end_dt)
    activity_count = act_q.count()

    return {
        "tasks_assigned": tasks_assigned,
        "tasks_completed": tasks_completed,
        "tasks_overdue": tasks_overdue,
        "completed_tasks": completed_tasks,
        "comments": comments_count,
        "replies": replies_count,
        "milestones": len(milestone_ids),
        "milestones_list": milestones_list,
        "files_uploaded": files_count,
        "activity_count": activity_count,
    }


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.get("")
def get_project_contributions(
    project_id: uuid.UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    milestone_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns contribution stats for all members of the project.
    All counts are derived from actual database records.
    No scores, no rankings.
    """
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    _verify_membership(db, project_id, user_id)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    members = (
        db.query(User, ProjectMember.project_role, ProjectMember.joined_at)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    result = []
    for user, role, joined_at in members:
        stats = _get_member_stats(db, project_id, user.id, start_dt, end_dt, milestone_id)
        result.append({
            "user": {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name or user.username,
                "email": user.email,
                "role": role,
                "joined_at": joined_at.isoformat() if joined_at else None,
            },
            "stats": stats,
        })

    return {
        "project_id": str(project_id),
        "project_name": project.name,
        "reporting_period": {
            "start": start_dt.isoformat() if start_dt else None,
            "end": end_dt.isoformat() if end_dt else None,
        },
        "disclaimer": "This report summarizes recorded project activity during the selected period. Activity counts reflect recorded actions, not a measurement of effort, quality, or individual ownership.",
        "members": result,
    }


@router.get("/{member_id}")
def get_member_contribution(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Detailed contribution for a single member, traceable to actual records."""
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    _verify_membership(db, project_id, user_id)

    member = db.get(User, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="User not found")

    _verify_membership(db, project_id, member_id)

    project = db.get(Project, project_id)
    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    stats = _get_member_stats(db, project_id, member_id, start_dt, end_dt)

    return {
        "project_id": str(project_id),
        "project_name": project.name if project else "",
        "member": {
            "id": str(member.id),
            "username": member.username,
            "full_name": member.full_name or member.username,
            "email": member.email,
        },
        "stats": stats,
        "reporting_period": {
            "start": start_dt.isoformat() if start_dt else None,
            "end": end_dt.isoformat() if end_dt else None,
        },
        "disclaimer": "This report summarizes recorded project activity. Counts reflect recorded actions only.",
    }


@router.get("/{member_id}/timeline")
def get_member_timeline(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    activity_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Paginated chronological activity timeline for a single member."""
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    _verify_membership(db, project_id, user_id)
    _verify_membership(db, project_id, member_id)

    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    q = db.query(TaskActivity).filter(
        TaskActivity.project_id == project_id,
        TaskActivity.actor_id == member_id,
    )
    if activity_type:
        try:
            q = q.filter(TaskActivity.activity_type == ActivityType(activity_type))
        except ValueError:
            pass
    if start_dt:
        q = q.filter(TaskActivity.created_at >= start_dt)
    if end_dt:
        q = q.filter(TaskActivity.created_at <= end_dt)

    total = q.count()
    activities = q.order_by(TaskActivity.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for act in activities:
        task = db.get(Task, act.task_id) if act.task_id else None
        act_type_val = act.activity_type.value if hasattr(act.activity_type, "value") else str(act.activity_type)
        items.append({
            "id": str(act.id),
            "activity_type": act_type_val,
            "label": _activity_label(act_type_val),
            "icon": _activity_icon(act_type_val),
            "content": act.content,
            "old_value": act.old_value,
            "new_value": act.new_value,
            "created_at": act.created_at.isoformat() if act.created_at else None,
            "task": {
                "id": str(task.id),
                "title": task.title,
                "status": task.status.value if hasattr(task.status, "value") else str(task.status),
            } if task else None,
        })

    return {
        "member_id": str(member_id),
        "project_id": str(project_id),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
        "items": items,
    }


@router.get("/activity/project-timeline")
def get_project_activity_timeline(
    project_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    user_id_filter: Optional[uuid.UUID] = Query(None, alias="user_id"),
    activity_type: Optional[str] = Query(None),
    milestone_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Project-wide activity timeline across all members, with filtering support."""
    curr_user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    _verify_membership(db, project_id, curr_user_id)

    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    q = db.query(TaskActivity).filter(TaskActivity.project_id == project_id)

    if user_id_filter:
        q = q.filter(TaskActivity.actor_id == user_id_filter)
    if activity_type:
        try:
            q = q.filter(TaskActivity.activity_type == ActivityType(activity_type))
        except ValueError:
            pass
    if start_dt:
        q = q.filter(TaskActivity.created_at >= start_dt)
    if end_dt:
        q = q.filter(TaskActivity.created_at <= end_dt)

    # Filter by milestone if provided: join through Task
    if milestone_id:
        q = q.join(Task, Task.id == TaskActivity.task_id).filter(Task.milestone_id == milestone_id)

    total = q.count()
    activities = q.order_by(TaskActivity.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for act in activities:
        task = db.get(Task, act.task_id) if act.task_id else None
        actor = db.get(User, act.actor_id) if act.actor_id else None
        act_type_val = act.activity_type.value if hasattr(act.activity_type, "value") else str(act.activity_type)
        items.append({
            "id": str(act.id),
            "activity_type": act_type_val,
            "label": _activity_label(act_type_val),
            "icon": _activity_icon(act_type_val),
            "content": act.content,
            "old_value": act.old_value,
            "new_value": act.new_value,
            "created_at": act.created_at.isoformat() if act.created_at else None,
            "actor": {
                "id": str(actor.id),
                "username": actor.username,
                "full_name": actor.full_name or actor.username,
            } if actor else None,
            "task": {
                "id": str(task.id),
                "title": task.title,
                "status": task.status.value if hasattr(task.status, "value") else str(task.status),
                "milestone_id": str(task.milestone_id) if task.milestone_id else None,
            } if task else None,
        })

    return {
        "project_id": str(project_id),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0,
        "items": items,
    }


@router.get("/report/data")
def get_contribution_report_data(
    project_id: uuid.UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Full structured report data used for UI preview and PDF generation."""
    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    _verify_membership(db, project_id, user_id)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    start_dt = _parse_date(start_date)
    end_dt = _parse_date(end_date)

    members = (
        db.query(User, ProjectMember.project_role, ProjectMember.joined_at)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    members_data = []
    for user, role, joined_at in members:
        stats = _get_member_stats(db, project_id, user.id, start_dt, end_dt)

        # Recent timeline (last 10 activities)
        recent_q = db.query(TaskActivity).filter(
            TaskActivity.project_id == project_id,
            TaskActivity.actor_id == user.id,
        ).order_by(TaskActivity.created_at.desc()).limit(10).all()

        timeline = []
        for act in recent_q:
            task = db.get(Task, act.task_id) if act.task_id else None
            act_type_val = act.activity_type.value if hasattr(act.activity_type, "value") else str(act.activity_type)
            timeline.append({
                "id": str(act.id),
                "activity_type": act_type_val,
                "label": _activity_label(act_type_val),
                "icon": _activity_icon(act_type_val),
                "content": act.content,
                "created_at": act.created_at.isoformat() if act.created_at else None,
                "task": {
                    "id": str(task.id),
                    "title": task.title,
                } if task else None,
            })

        members_data.append({
            "user": {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name or user.username,
                "email": user.email,
                "role": role,
            },
            "stats": stats,
            "recent_timeline": timeline,
        })

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "project_type": project.project_type,
        },
        "reporting_period": {
            "start": start_dt.isoformat() if start_dt else None,
            "end": end_dt.isoformat() if end_dt else None,
        },
        "disclaimer": "This report summarizes recorded project activity during the selected period. Activity counts reflect recorded actions, not a measurement of effort, quality, difficulty, or individual ownership.",
        "team_size": len(members),
        "members": members_data,
        "milestones": [
            {"id": str(m.id), "title": m.title, "is_completed": m.is_completed, "due_date": m.due_date.isoformat() if m.due_date else None}
            for m in milestones
        ],
    }
