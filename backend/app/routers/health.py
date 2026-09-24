"""
Project Health Dashboard Router
Computes transparent, explainable, and deterministic project health indicators
from actual database records without black-box scores.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Project,
    ProjectMember,
    Task,
    TaskStatus,
    TaskPriority,
    TaskDependency,
    DependencyType,
    TaskActivity,
    Milestone,
    User,
)

router = APIRouter(prefix="/projects/{project_id}/health", tags=["Project Health"])


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


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


@router.get("")
def get_project_health(
    project_id: uuid.UUID,
    stalled_days: int = Query(5, ge=1, le=60, description="Threshold in days to flag a task as stalled/inactive"),
    upcoming_days: int = Query(3, ge=1, le=30, description="Threshold in days for approaching deadlines"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a comprehensive, deterministic health evaluation of the project:
    - Overall progress & task completion %
    - Task health categorization (On Track, At Risk, Overdue, Blocked, Not Started, Done)
    - Actionable 'Why Attention Is Needed' risk drivers
    - Detailed drill-down lists for Overdue, Blocked, Stalled, Upcoming, and Unassigned tasks
    - Team workload distribution & neutral imbalance indicators
    - Milestone health evaluation
    """
    user_id = current_user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    _verify_membership(db, project_id, user_id)

    now = datetime.utcnow()

    # 1. Fetch all tasks for this project
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    total_tasks = len(tasks)

    # 2. Fetch all members
    memberships = (
        db.query(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )
    user_map = {str(u.id): u.full_name or u.username for _, u in memberships}

    # 3. Fetch all milestones
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()
    milestone_map = {str(m.id): m.title for m in milestones}

    # 4. Fetch dependencies for project tasks
    task_ids = [t.id for t in tasks]
    dependencies = []
    if task_ids:
        dependencies = (
            db.query(TaskDependency)
            .filter(
                or_(
                    TaskDependency.task_id.in_(task_ids),
                    TaskDependency.depends_on_task_id.in_(task_ids),
                )
            )
            .all()
        )

    # Build dependency lookup: task_id -> list of tasks it depends on
    # and map of task_id -> Task object
    task_by_id = {t.id: t for t in tasks}
    blocked_by_map: Dict[uuid.UUID, List[Dict[str, Any]]] = {t.id: [] for t in tasks}
    for dep in dependencies:
        if dep.task_id in blocked_by_map and dep.depends_on_task_id in task_by_id:
            parent_task = task_by_id[dep.depends_on_task_id]
            is_parent_done = parent_task.status == TaskStatus.DONE
            blocked_by_map[dep.task_id].append({
                "id": str(parent_task.id),
                "title": parent_task.title,
                "status": parent_task.status.value if hasattr(parent_task.status, "value") else str(parent_task.status),
                "is_completed": is_parent_done,
            })

    # 5. Fetch latest activity timestamp per task for stalled detection
    latest_activity_map: Dict[uuid.UUID, datetime] = {}
    if task_ids:
        latest_activities = (
            db.query(
                TaskActivity.task_id,
                func.max(TaskActivity.created_at).label("latest_at"),
            )
            .filter(TaskActivity.task_id.in_(task_ids))
            .group_by(TaskActivity.task_id)
            .all()
        )
        for t_id, l_at in latest_activities:
            if t_id and l_at:
                latest_activity_map[t_id] = l_at

    # ─────────────────────────────────────────────────────────────
    # Classification & Detailed Lists
    # ─────────────────────────────────────────────────────────────
    completed_tasks = 0
    overdue_list = []
    blocked_list = []
    stalled_list = []
    upcoming_list = []
    unassigned_list = []
    not_started_count = 0

    stalled_cutoff = now - timedelta(days=stalled_days)
    upcoming_cutoff = now + timedelta(days=upcoming_days)

    for task in tasks:
        is_done = task.status == TaskStatus.DONE
        assignee_name = user_map.get(str(task.assignee_id)) if task.assignee_id else None
        milestone_title = milestone_map.get(str(task.milestone_id)) if task.milestone_id else None

        if is_done:
            completed_tasks += 1
            continue

        if task.status == TaskStatus.TODO:
            not_started_count += 1

        task_due_date = _to_naive_utc(task.due_date)
        task_created_at = _to_naive_utc(task.created_at)
        task_updated_at = _to_naive_utc(task.updated_at)

        task_dict = {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status.value if hasattr(task.status, "value") else str(task.status),
            "priority": task.priority.value if hasattr(task.priority, "value") else str(task.priority),
            "assignee_id": str(task.assignee_id) if task.assignee_id else None,
            "assignee_name": assignee_name,
            "milestone_id": str(task.milestone_id) if task.milestone_id else None,
            "milestone_title": milestone_title,
            "due_date": task_due_date.isoformat() if task_due_date else None,
            "created_at": task_created_at.isoformat() if task_created_at else None,
            "updated_at": task_updated_at.isoformat() if task_updated_at else None,
        }

        # Check Overdue
        if task_due_date and task_due_date < now:
            days_overdue = max(1, (now - task_due_date).days)
            overdue_list.append({
                **task_dict,
                "days_overdue": days_overdue,
            })

        # Check Blocked: explicit BLOCKED or has incomplete dependency
        has_unresolved_dep = any(not dep["is_completed"] for dep in blocked_by_map.get(task.id, []))
        if task.status == TaskStatus.BLOCKED or has_unresolved_dep:
            blocked_list.append({
                **task_dict,
                "blocked_by": blocked_by_map.get(task.id, []),
                "is_explicit_blocked": task.status == TaskStatus.BLOCKED,
            })

        # Check Stalled: in progress / review, not updated / no activity in `stalled_days`
        raw_last_act = latest_activity_map.get(task.id, task.updated_at or task.created_at or now)
        last_act = _to_naive_utc(raw_last_act) or now
        if task.status in (TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW) and last_act < stalled_cutoff:
            days_inactive = max(1, (now - last_act).days)
            stalled_list.append({
                **task_dict,
                "days_inactive": days_inactive,
                "last_activity_at": last_act.isoformat() if last_act else None,
            })

        # Check Approaching Deadlines: due between now and upcoming_cutoff
        if task_due_date and now <= task_due_date <= upcoming_cutoff:
            hours_left = max(0, int((task_due_date - now).total_seconds() // 3600))
            days_left = max(0, (task_due_date.date() - now.date()).days)
            upcoming_list.append({
                **task_dict,
                "days_left": days_left,
                "hours_left": hours_left,
            })

        # Check Unassigned
        if not task.assignee_id:
            unassigned_list.append(task_dict)

    # Sort upcoming by earliest due date, then highest priority
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    upcoming_list.sort(
        key=lambda x: (
            x["due_date"] or "9999",
            priority_order.get(x["priority"], 99),
        )
    )
    overdue_list.sort(key=lambda x: x["days_overdue"], reverse=True)
    stalled_list.sort(key=lambda x: x["days_inactive"], reverse=True)

    # ─────────────────────────────────────────────────────────────
    # Health Category Counts (Avoid double counting for primary cards)
    # ─────────────────────────────────────────────────────────────
    overdue_count = len(overdue_list)
    blocked_count = len(blocked_list)
    stalled_count = len(stalled_list)
    unassigned_count = len(unassigned_list)

    # At-risk tasks count (Stalled + Urgent upcoming with no progress)
    urgent_todo_count = sum(1 for u in upcoming_list if u["status"] == "TODO" and u["days_left"] <= 1)
    at_risk_count = stalled_count + urgent_todo_count

    # On-track tasks count: non-overdue, non-blocked, non-stalled active tasks + completed tasks
    active_problem_ids = set([t["id"] for t in overdue_list] + [t["id"] for t in blocked_list] + [t["id"] for t in stalled_list])
    on_track_active_count = sum(1 for t in tasks if t.status != TaskStatus.DONE and str(t.id) not in active_problem_ids)
    on_track_count = on_track_active_count + completed_tasks

    completion_percentage = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0

    # ─────────────────────────────────────────────────────────────
    # Team Workload Calculation
    # ─────────────────────────────────────────────────────────────
    member_workloads = []
    total_active_tasks = total_tasks - completed_tasks

    for pm, user in memberships:
        user_tasks = [t for t in tasks if t.assignee_id == user.id]
        active_count = sum(1 for t in user_tasks if t.status != TaskStatus.DONE)
        done_count = sum(1 for t in user_tasks if t.status == TaskStatus.DONE)
        overdue_member_count = sum(
            1 for t in user_tasks 
            if t.status != TaskStatus.DONE and _to_naive_utc(t.due_date) and _to_naive_utc(t.due_date) < now
        )

        member_workloads.append({
            "user_id": str(user.id),
            "username": user.username,
            "full_name": user.full_name or user.username,
            "project_role": pm.project_role,
            "active_tasks": active_count,
            "completed_tasks": done_count,
            "overdue_tasks": overdue_member_count,
        })

    num_members = len(member_workloads)
    team_avg_active = round(total_active_tasks / num_members, 1) if num_members > 0 else 0.0

    # Flag neutral imbalance where member is substantially above team average
    imbalanced_members = []
    for m in member_workloads:
        diff = m["active_tasks"] - team_avg_active
        is_above = m["active_tasks"] >= 3 and diff >= 2.0
        m["is_above_average"] = is_above
        m["deviation_from_avg"] = round(diff, 1)
        if is_above:
            imbalanced_members.append(m)

    # Sort members by active workload descending
    member_workloads.sort(key=lambda x: x["active_tasks"], reverse=True)

    # ─────────────────────────────────────────────────────────────
    # Milestone Health Evaluation
    # ─────────────────────────────────────────────────────────────
    milestone_health_list = []
    at_risk_milestones_count = 0

    for m in milestones:
        m_due_date = _to_naive_utc(m.due_date)
        m_tasks = [t for t in tasks if t.milestone_id == m.id]
        m_total = len(m_tasks)
        m_done = sum(1 for t in m_tasks if t.status == TaskStatus.DONE)
        m_overdue = sum(
            1 for t in m_tasks 
            if t.status != TaskStatus.DONE and _to_naive_utc(t.due_date) and _to_naive_utc(t.due_date) < now
        )
        m_progress = round((m_done / m_total) * 100, 1) if m_total > 0 else (100.0 if m.is_completed else 0.0)

        # Milestone health classification
        if m.is_completed or (m_total > 0 and m_done == m_total):
            m_status = "COMPLETED"
        elif m_due_date and m_due_date < now and not m.is_completed:
            m_status = "OVERDUE"
            at_risk_milestones_count += 1
        elif m_overdue > 0 or (m_due_date and (m_due_date - now).days <= 5 and m_progress < 50.0):
            m_status = "AT_RISK"
            at_risk_milestones_count += 1
        elif m_total == 0:
            m_status = "NO_TASKS"
        else:
            m_status = "HEALTHY"

        milestone_health_list.append({
            "id": str(m.id),
            "title": m.title,
            "description": m.description,
            "due_date": m_due_date.isoformat() if m_due_date else None,
            "is_completed": m.is_completed,
            "total_tasks": m_total,
            "completed_tasks": m_done,
            "overdue_tasks": m_overdue,
            "progress_percentage": m_progress,
            "health_status": m_status,
        })

    # ─────────────────────────────────────────────────────────────
    # Overall Project Health State & Explainable Reasons
    # ─────────────────────────────────────────────────────────────
    reasons = []

    if overdue_count > 0:
        reasons.append({
            "id": "overdue",
            "type": "ERROR",
            "title": f"{overdue_count} overdue task{'s' if overdue_count > 1 else ''}",
            "description": "Tasks are past their deadline and not yet marked as completed.",
            "count": overdue_count,
            "target_tab": "overdue",
        })

    if blocked_count > 0:
        reasons.append({
            "id": "blocked",
            "type": "ERROR",
            "title": f"{blocked_count} blocked task{'s' if blocked_count > 1 else ''}",
            "description": "Tasks are marked as blocked or waiting on incomplete prerequisite tasks.",
            "count": blocked_count,
            "target_tab": "blocked",
        })

    if stalled_count > 0:
        reasons.append({
            "id": "stalled",
            "type": "WARNING",
            "title": f"{stalled_count} stalled task{'s' if stalled_count > 1 else ''}",
            "description": f"In-progress tasks with no recorded activity for >{stalled_days} days.",
            "count": stalled_count,
            "target_tab": "stalled",
        })

    if unassigned_count > 0:
        reasons.append({
            "id": "unassigned",
            "type": "WARNING",
            "title": f"{unassigned_count} unassigned task{'s' if unassigned_count > 1 else ''}",
            "description": "Active tasks currently without an assigned team member.",
            "count": unassigned_count,
            "target_tab": "unassigned",
        })

    if imbalanced_members:
        names = ", ".join(m["full_name"] for m in imbalanced_members[:2])
        reasons.append({
            "id": "workload",
            "type": "INFO",
            "title": "Workload distribution notice",
            "description": f"{names} currently {'has' if len(imbalanced_members) == 1 else 'have'} a higher active-task count than team average ({team_avg_active}).",
            "count": len(imbalanced_members),
            "target_tab": "workload",
        })

    if at_risk_milestones_count > 0:
        reasons.append({
            "id": "milestones",
            "type": "WARNING",
            "title": f"{at_risk_milestones_count} milestone{'s' if at_risk_milestones_count > 1 else ''} needing attention",
            "description": "Milestones approaching deadline with overdue or incomplete tasks.",
            "count": at_risk_milestones_count,
            "target_tab": "milestones",
        })

    # Determine Project Status
    if total_tasks == 0:
        overall_status = "NO_DATA"
        status_label = "No Task Data"
        status_description = "Create tasks to begin tracking real-time project health and risks."
    elif overdue_count > 0 or blocked_count > 0 or (total_tasks > 0 and (overdue_count + blocked_count) / total_tasks >= 0.25):
        overall_status = "AT_RISK"
        status_label = "At Risk"
        status_description = "Critical blockers or overdue deadlines require immediate team attention."
    elif stalled_count > 0 or unassigned_count > 0 or at_risk_milestones_count > 0:
        overall_status = "NEEDS_ATTENTION"
        status_label = "Needs Attention"
        status_description = "Project is moving, but has stalled work or unassigned items to address."
    else:
        overall_status = "HEALTHY"
        status_label = "Healthy"
        status_description = "All tasks are on track with no active blockers or overdue deadlines."

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "project_status": project.status,
        "project_type": project.project_type,
        "overall_health": {
            "status": overall_status,
            "label": status_label,
            "description": status_description,
            "task_completion_percentage": completion_percentage,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "active_tasks": total_active_tasks,
            "is_empty": total_tasks == 0,
        },
        "breakdown": {
            "on_track": on_track_count,
            "at_risk": at_risk_count,
            "overdue": overdue_count,
            "blocked": blocked_count,
            "not_started": not_started_count,
            "done": completed_tasks,
        },
        "reasons": reasons,
        "overdue_tasks": overdue_list,
        "blocked_tasks": blocked_list,
        "stalled_tasks": stalled_list,
        "upcoming_tasks": upcoming_list,
        "unassigned_tasks": unassigned_list,
        "workload": {
            "team_average_active_tasks": team_avg_active,
            "total_active_tasks": total_active_tasks,
            "members": member_workloads,
        },
        "milestones": milestone_health_list,
        "config": {
            "stalled_days_threshold": stalled_days,
            "upcoming_days_threshold": upcoming_days,
        },
    }
