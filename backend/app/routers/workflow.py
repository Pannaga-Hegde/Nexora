import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import Request, Notification, CalendarEvent, Task, User, Project, ProjectMember
from app.dependencies import get_current_user
from app.services.notifications import trigger_notification

router = APIRouter(prefix="/workflow", tags=["Workflow & Accountability"])

# Schemas
class RequestRespondPayload(BaseModel):
    action: str  # ACCEPT or REJECT

class RequestResponseSchema(BaseModel):
    id: str
    requester_name: str
    request_type: str
    status: str
    title: str
    details: Optional[str]
    created_at: str

class NotificationResponseSchema(BaseModel):
    id: str
    title: str
    message: str
    is_read: bool
    link_url: Optional[str]
    created_at: str

class CalendarEventCreatePayload(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = "MEETING"
    start_time: str
    end_time: Optional[str] = None

class CalendarEventResponseSchema(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    event_type: str
    start_time: str
    end_time: Optional[str] = None
    creator_id: Optional[str] = None
    creator_name: Optional[str] = None

# ============================================================
# REQUESTS ENDPOINTS
# ============================================================

@router.get("/requests", response_model=List[RequestResponseSchema])
def get_user_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    reqs = (
        db.query(Request, User.full_name, User.username)
        .outerjoin(User, Request.requester_id == User.id)
        .filter(Request.recipient_id == current_user["id"])
        .order_by(Request.created_at.desc())
        .all()
    )

    result = []
    for r, full_name, username in reqs:
        result.append({
            "id": str(r.id),
            "requester_name": full_name or username or "Project OS System",
            "request_type": r.request_type,
            "status": r.status,
            "title": r.title,
            "details": r.details,
            "created_at": r.created_at.isoformat(),
        })
    return result

@router.post("/requests/{request_id}/respond", response_model=RequestResponseSchema)
def respond_to_request(
    request_id: uuid.UUID,
    payload: RequestRespondPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    req = db.get(Request, request_id)
    if not req or req.recipient_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="Request not found")

    action = payload.action.upper()
    if action not in ["ACCEPT", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be ACCEPT or REJECT")

    req.status = "ACCEPTED" if action == "ACCEPT" else "REJECTED"
    db.commit()
    db.refresh(req)

    # Notify requester of decision
    if req.requester_id:
        trigger_notification(
            db=db,
            user_id=req.requester_id,
            title=f"Request {req.status.capitalize()}",
            message=f"{current_user.get('full_name')} {req.status.lower()}d your request: '{req.title}'",
            link_url="/requests",
        )

    requester_user = db.get(User, req.requester_id) if req.requester_id else None
    requester_name = requester_user.full_name if requester_user else "System"

    return {
        "id": str(req.id),
        "requester_name": requester_name,
        "request_type": req.request_type,
        "status": req.status,
        "title": req.title,
        "details": req.details,
        "created_at": req.created_at.isoformat(),
    }

# ============================================================
# NOTIFICATIONS ENDPOINTS
# ============================================================

@router.get("/notifications", response_model=List[NotificationResponseSchema])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user["id"])
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )

    result = []
    for n in notifs:
        result.append({
            "id": str(n.id),
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "link_url": n.link_url,
            "created_at": n.created_at.isoformat(),
        })
    return result

@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    notif = db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user["id"]:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "success"}

# ============================================================
# CALENDAR EVENTS ENDPOINTS
# ============================================================

@router.get("/calendar/events/{project_id}", response_model=List[CalendarEventResponseSchema])
def get_calendar_events(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Combine custom calendar events and task due dates
    events = (
        db.query(CalendarEvent, User.full_name, User.username)
        .outerjoin(User, CalendarEvent.creator_id == User.id)
        .filter(CalendarEvent.project_id == project_id)
        .all()
    )
    result = []
    for e, full_name, username in events:
        result.append({
            "id": str(e.id),
            "project_id": str(e.project_id),
            "title": e.title,
            "description": e.description,
            "event_type": e.event_type,
            "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat() if e.end_time else None,
            "creator_id": str(e.creator_id) if e.creator_id else None,
            "creator_name": full_name or username if (full_name or username) else None,
        })

    # Pull tasks with due dates
    tasks_with_due = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.due_date.isnot(None))
        .all()
    )
    for t in tasks_with_due:
        if t.due_date:
            result.append({
                "id": f"task-{t.id}",
                "project_id": str(t.project_id),
                "title": f"Deadline: {t.title}",
                "description": t.description or "Task due date",
                "event_type": "DEADLINE",
                "start_time": t.due_date.isoformat(),
                "end_time": None,
                "creator_id": None,
                "creator_name": None,
            })

    return result

@router.post("/calendar/events/{project_id}", response_model=CalendarEventResponseSchema, status_code=status.HTTP_201_CREATED)
def create_calendar_event(
    project_id: uuid.UUID,
    payload: CalendarEventCreatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    event_type = (payload.event_type or "MEETING").upper()

    evt = CalendarEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        creator_id=user_id,
        title=payload.title,
        description=payload.description,
        event_type=event_type,
        start_time=datetime.fromisoformat(payload.start_time.replace("Z", "+00:00")),
        end_time=datetime.fromisoformat(payload.end_time.replace("Z", "+00:00")) if payload.end_time else None,
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)

    scheduler_name = current_user.get("full_name") or current_user.get("username") or "A team member"

    # Format time string for notifications
    try:
        if evt.end_time:
            time_str = f"{evt.start_time.strftime('%A, %b %d, %Y (%I:%M %p')} – {evt.end_time.strftime('%I:%M %p')})"
        else:
            time_str = f"{evt.start_time.strftime('%A, %b %d, %Y at %I:%M %p')}"
    except Exception:
        time_str = evt.start_time.isoformat()

    # Notify all project members (except the scheduler)
    members = db.scalars(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id != user_id
        )
    ).all()

    for m in members:
        trigger_notification(
            db=db,
            user_id=m.user_id,
            title=f"New meeting scheduled for {project.name}",
            message=f"Scheduled by {scheduler_name}: \"{evt.title}\" on {time_str}",
            link_url=f"/calendar"
        )

    return {
        "id": str(evt.id),
        "project_id": str(evt.project_id),
        "title": evt.title,
        "description": evt.description,
        "event_type": evt.event_type,
        "start_time": evt.start_time.isoformat(),
        "end_time": evt.end_time.isoformat() if evt.end_time else None,
        "creator_id": str(evt.creator_id) if evt.creator_id else None,
        "creator_name": scheduler_name,
    }


def handle_cancel_calendar_event(
    event_id: uuid.UUID,
    db: Session,
    current_user: dict,
):
    evt = db.get(CalendarEvent, event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Calendar event / meeting not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]

    # Authorization check: only the scheduler (creator) can cancel
    if evt.creator_id and evt.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the user who scheduled the meeting can cancel it."
        )

    project = db.get(Project, evt.project_id)
    project_name = project.name if project else "the project"
    scheduler_name = current_user.get("full_name") or current_user.get("username") or "The scheduler"

    # Notify affected project participants
    members = db.scalars(
        select(ProjectMember).where(
            ProjectMember.project_id == evt.project_id,
            ProjectMember.user_id != user_id
        )
    ).all()

    for m in members:
        trigger_notification(
            db=db,
            user_id=m.user_id,
            title="Meeting cancelled",
            message=f"{scheduler_name} cancelled the meeting \"{evt.title}\" for {project_name}.",
            link_url=f"/calendar"
        )

    db.delete(evt)
    db.commit()

    return {
        "status": "success",
        "message": f"Meeting \"{evt.title}\" has been cancelled.",
        "id": str(event_id)
    }


@router.delete("/calendar/events/{event_id}", status_code=status.HTTP_200_OK)
def delete_calendar_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Cancels a scheduled meeting (Only permissible for the scheduler).
    """
    return handle_cancel_calendar_event(event_id, db, current_user)


@router.post("/calendar/events/{event_id}/cancel", status_code=status.HTTP_200_OK)
def cancel_calendar_event_post(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Cancels a scheduled meeting (Only permissible for the scheduler).
    """
    return handle_cancel_calendar_event(event_id, db, current_user)

