"""
Task Risk Detection Engine
Deterministic, rule-based risk evaluation based entirely on observable database evidence.
No arbitrary black-box scores.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from app.models import Task, TaskStatus, TaskPriority, TaskDependency, Milestone, TaskActivity


class TaskRiskConfig:
    DEADLINE_WARNING_DAYS: int = 3
    DEADLINE_CRITICAL_HOURS: int = 24
    STALE_ACTIVITY_DAYS: int = 5


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def evaluate_task_risk(
    task: Task,
    blocked_by: Optional[List[Dict[str, Any]]] = None,
    latest_activity_dt: Optional[datetime] = None,
    milestone: Optional[Milestone] = None,
    stalled_days_threshold: int = TaskRiskConfig.STALE_ACTIVITY_DAYS,
    deadline_warning_days: int = TaskRiskConfig.DEADLINE_WARNING_DAYS,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Evaluates risk for a single task based on observable signals:
    - Primary status hierarchy: BLOCKED > AT_RISK > ON_TRACK
    - Generates standardized reason codes with clear human-readable explanations.
    """
    if now is None:
        now = datetime.utcnow()

    reasons: List[Dict[str, Any]] = []
    blocked_by = blocked_by or []

    # 1. Completed tasks are always ON_TRACK with no risk reasons
    if task.status == TaskStatus.DONE:
        return {
            "status": "ON_TRACK",
            "label": "On Track",
            "is_completed": True,
            "reasons": [],
            "primary_reason": None,
        }

    task_due_date = to_naive_utc(task.due_date)
    task_created_at = to_naive_utc(task.created_at)
    task_updated_at = to_naive_utc(task.updated_at)

    # 2. Check Explicit Blocked or Dependency Blocked
    has_unresolved_dependencies = any(not dep.get("is_completed", False) for dep in blocked_by)
    if task.status == TaskStatus.BLOCKED:
        reasons.append({
            "code": "explicit_blocked",
            "severity": "CRITICAL",
            "title": "Task is marked as Blocked",
            "detail": "Task has been explicitly placed into Blocked state by team.",
            "meta": {},
        })
    elif has_unresolved_dependencies:
        incomplete_parents = [dep["title"] for dep in blocked_by if not dep.get("is_completed", False)]
        parents_str = ", ".join(incomplete_parents[:2])
        reasons.append({
            "code": "dependency_incomplete",
            "severity": "CRITICAL",
            "title": "Dependency incomplete",
            "detail": f"Blocked by prerequisite task: {parents_str}",
            "meta": {"blocked_by": blocked_by},
        })

    # 3. Check Overdue
    if task_due_date and task_due_date < now:
        days_overdue = max(1, (now - task_due_date).days)
        reasons.append({
            "code": "deadline_overdue",
            "severity": "CRITICAL",
            "title": "Deadline passed (Overdue)",
            "detail": f"Task is {days_overdue} day{'s' if days_overdue > 1 else ''} past its due date ({task_due_date.strftime('%b %d')}).",
            "meta": {"days_overdue": days_overdue},
        })

    # 4. Check Approaching Deadline
    elif task_due_date and now <= task_due_date <= (now + timedelta(days=deadline_warning_days)):
        days_left = max(0, (task_due_date.date() - now.date()).days)
        hours_left = max(0, int((task_due_date - now).total_seconds() // 3600))
        
        if task.status == TaskStatus.TODO:
            reasons.append({
                "code": "deadline_approaching",
                "severity": "HIGH",
                "title": "Deadline approaching with no progress",
                "detail": f"Due in {days_left} day{'s' if days_left > 1 else ''} (or {hours_left}h) while still in To-Do state.",
                "meta": {"days_left": days_left, "hours_left": hours_left},
            })
        else:
            reasons.append({
                "code": "deadline_approaching",
                "severity": "MEDIUM",
                "title": "Deadline approaching",
                "detail": f"Due in {days_left} day{'s' if days_left > 1 else ''} ({task_due_date.strftime('%b %d')}).",
                "meta": {"days_left": days_left, "hours_left": hours_left},
            })

    # 5. Check Stale Activity (Inactivity in active state)
    stalled_cutoff = now - timedelta(days=stalled_days_threshold)
    raw_last_act = latest_activity_dt or task_updated_at or task_created_at
    last_act = to_naive_utc(raw_last_act)

    if task.status in (TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW):
        if last_act and last_act < stalled_cutoff:
            days_inactive = max(1, (now - last_act).days)
            reasons.append({
                "code": "stale_activity",
                "severity": "MEDIUM",
                "title": f"No recorded activity for {days_inactive} days",
                "detail": f"Last recorded activity was on {last_act.strftime('%b %d')}.",
                "meta": {"days_inactive": days_inactive, "last_activity_at": last_act.isoformat()},
            })
        elif not last_act and task_created_at and (now - task_created_at).days >= 3:
            reasons.append({
                "code": "stale_activity",
                "severity": "LOW",
                "title": "No recorded activity yet",
                "detail": "No progress updates or discussion comments recorded since task creation.",
                "meta": {},
            })

    # 6. Check Unassigned
    if not task.assignee_id:
        if task.priority in (TaskPriority.CRITICAL, TaskPriority.HIGH) or (task_due_date and (task_due_date - now).days <= 3):
            reasons.append({
                "code": "unassigned",
                "severity": "MEDIUM",
                "title": "Active task is unassigned",
                "detail": "No team member is currently responsible for this high-priority or upcoming task.",
                "meta": {},
            })
        else:
            reasons.append({
                "code": "unassigned",
                "severity": "LOW",
                "title": "Unassigned work",
                "detail": "No team member is currently assigned to this task.",
                "meta": {},
            })

    # 7. Check Milestone Risk
    if milestone:
        m_due = to_naive_utc(milestone.due_date)
        if m_due and m_due < now and not milestone.is_completed:
            reasons.append({
                "code": "milestone_at_risk",
                "severity": "MEDIUM",
                "title": "Associated milestone is overdue",
                "detail": f"Milestone '{milestone.title}' is past its target completion deadline.",
                "meta": {"milestone_id": str(milestone.id), "milestone_title": milestone.title},
            })

    # Determine Primary Status
    has_critical_blocker = any(r["code"] in ("explicit_blocked", "dependency_incomplete") for r in reasons)
    has_at_risk_condition = any(r["code"] in ("deadline_overdue", "deadline_approaching", "stale_activity", "milestone_at_risk") for r in reasons)

    if has_critical_blocker:
        primary_status = "BLOCKED"
        primary_label = "Blocked"
    elif has_at_risk_condition:
        primary_status = "AT_RISK"
        primary_label = "At Risk"
    else:
        primary_status = "ON_TRACK"
        primary_label = "On Track"

    primary_reason = reasons[0]["title"] if reasons else None

    return {
        "status": primary_status,
        "label": primary_label,
        "is_completed": False,
        "reasons": reasons,
        "primary_reason": primary_reason,
    }
