import re
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import Task, TaskComment, CommentAttachment, CommentMention, ProjectMember, User, TaskActivity, ActivityType
from app.dependencies import get_current_user
from app.websockets import manager
from app.services.storage_service import (
    storage_service,
    StorageConfigurationError,
    StorageOperationError,
    FileValidationError,
)

router = APIRouter(tags=["Task Discussion"])

MAX_COMMENT_LENGTH = 10000


class CommentCreatePayload(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_COMMENT_LENGTH)
    parent_comment_id: Optional[uuid.UUID] = None
    attachment_ids: Optional[List[uuid.UUID]] = None


class CommentUpdatePayload(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_COMMENT_LENGTH)


class ConvertTaskPayload(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    priority: Optional[str] = "MEDIUM"
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[str] = None


class LinkTaskPayload(BaseModel):
    target_task_id: uuid.UUID


def check_project_membership(db: Session, user_id: uuid.UUID, project_id: uuid.UUID):
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You must be a member of this project to access discussions."
        )
    return membership


def serialize_attachment(a: CommentAttachment) -> dict:
    resolved_url = a.file_url
    if storage_service.is_configured() and resolved_url and not resolved_url.startswith("http://") and not resolved_url.startswith("https://"):
        try:
            resolved_url = storage_service.create_signed_url(resolved_url, expires_in=3600)
        except Exception:
            pass  # Fallback to stored path if signing fails

    return {
        "id": str(a.id),
        "file_name": a.file_name,
        "file_url": resolved_url,
        "storage_key": a.file_url,
        "file_size_bytes": a.file_size_bytes,
        "mime_type": a.mime_type,
    }


def serialize_comment(c: TaskComment) -> dict:
    return {
        "id": str(c.id),
        "task_id": str(c.task_id),
        "parent_comment_id": str(c.parent_comment_id) if c.parent_comment_id else None,
        "content": c.content,
        "is_pinned": c.is_pinned,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "author": {
            "id": str(c.author.id) if c.author else None,
            "username": c.author.username if c.author else "Unknown",
            "full_name": c.author.full_name or c.author.username if c.author else "Unknown User",
            "email": c.author.email if c.author else "",
        } if c.author else None,
        "attachments": [
            serialize_attachment(a)
            for a in (c.comment_attachments or [])
        ],
        "mentions": [
            {
                "user_id": str(m.mentioned_user_id),
                "username": m.mentioned_user.username if m.mentioned_user else "",
                "full_name": m.mentioned_user.full_name or m.mentioned_user.username if m.mentioned_user else "",
            }
            for m in (c.mentions or [])
        ],
        "converted_task": {
            "id": str(c.converted_task.id),
            "title": c.converted_task.title,
            "status": c.converted_task.status,
        } if c.converted_task else None,
        "linked_task": {
            "id": str(c.linked_task.id),
            "title": c.linked_task.title,
            "status": c.linked_task.status,
        } if c.linked_task else None,
        "replies": [serialize_comment(reply) for reply in (c.replies or [])] if hasattr(c, "replies") and c.replies else []
    }


@router.get("/tasks/{task_id}/discussion")
def get_task_discussion(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    # Fetch top-level comments for task (parent_comment_id IS NULL)
    comments = db.scalars(
        select(TaskComment)
        .where(TaskComment.task_id == task_id, TaskComment.parent_comment_id.is_(None))
        .order_by(TaskComment.is_pinned.desc(), TaskComment.created_at.asc())
    ).all()

    # Separate pinned comments for easy top banner retrieval
    pinned_comments = [c for c in comments if c.is_pinned]

    return {
        "task_id": str(task_id),
        "project_id": str(task.project_id),
        "pinned_comments": [serialize_comment(c) for c in pinned_comments],
        "comments": [serialize_comment(c) for c in comments],
    }


@router.post("/tasks/{task_id}/discussion")
async def create_discussion_comment(
    task_id: uuid.UUID,
    payload: CommentCreatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content cannot be empty.")

    comment = TaskComment(
        id=uuid.uuid4(),
        task_id=task_id,
        author_id=user_id,
        parent_comment_id=payload.parent_comment_id,
        content=content,
        is_pinned=False,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Link temporary attachments if provided
    if payload.attachment_ids:
        attachments = db.scalars(
            select(CommentAttachment).where(CommentAttachment.id.in_(payload.attachment_ids))
        ).all()
        for att in attachments:
            att.comment_id = comment.id
        db.commit()

    # Parse and store @mentions against project members
    # Matches patterns like @username
    mention_tokens = set(re.findall(r'@([a-zA-Z0-9_\-\.]+)', content))
    if mention_tokens:
        project_members = db.scalars(
            select(User)
            .join(ProjectMember, ProjectMember.user_id == User.id)
            .where(
                ProjectMember.project_id == task.project_id,
                User.username.in_(mention_tokens)
            )
        ).all()

        for member in project_members:
            mention_entry = CommentMention(
                id=uuid.uuid4(),
                comment_id=comment.id,
                mentioned_user_id=member.id,
            )
            db.add(mention_entry)
        db.commit()

    db.refresh(comment)

    # Record contribution activity: COMMENT_CREATED or REPLY_CREATED
    activity_type = ActivityType.REPLY_CREATED if payload.parent_comment_id else ActivityType.COMMENT_CREATED
    db.add(TaskActivity(
        task_id=task_id,
        project_id=task.project_id,
        actor_id=user_id,
        activity_type=activity_type,
        content=content[:255] if content else None,
    ))
    db.commit()

    db.refresh(comment)
    result_data = serialize_comment(comment)

    # Real-time WebSocket broadcast to project channel
    await manager.broadcast(str(task.project_id), {
        "event": "TASK_COMMENT_ADDED",
        "task_id": str(task_id),
        "comment": result_data,
    })

    return result_data


@router.patch("/tasks/{task_id}/discussion/{comment_id}")
async def edit_discussion_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentUpdatePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only edit your own comments.")

    comment.content = payload.content.strip()
    comment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)

    result_data = serialize_comment(comment)

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_COMMENT_UPDATED",
        "task_id": str(task_id),
        "comment": result_data,
    })

    return result_data


@router.delete("/tasks/{task_id}/discussion/{comment_id}")
async def delete_discussion_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only the author can delete their own comment
    if comment.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only delete your own comments."
        )

    db.delete(comment)
    db.commit()

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_COMMENT_DELETED",
        "task_id": str(task_id),
        "comment_id": str(comment_id),
    })

    return {"message": "Comment deleted successfully", "comment_id": str(comment_id)}


@router.post("/tasks/{task_id}/discussion/{comment_id}/pin")
async def pin_discussion_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.is_pinned = True
    db.commit()
    db.refresh(comment)

    result_data = serialize_comment(comment)

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_COMMENT_PINNED",
        "task_id": str(task_id),
        "comment": result_data,
    })

    return result_data


@router.delete("/tasks/{task_id}/discussion/{comment_id}/pin")
async def unpin_discussion_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.is_pinned = False
    db.commit()
    db.refresh(comment)

    result_data = serialize_comment(comment)

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_COMMENT_UNPINNED",
        "task_id": str(task_id),
        "comment": result_data,
    })

    return result_data


def parse_ai_extracted_task_details(content: str, db: Session, project_id: uuid.UUID):
    """
    AI NLP task extractor that parses text like:
    'We need to fix the authentication bug before Friday. Assigning to Rahul.'
    Returns title, priority, assignee_id, and calculated due_date.
    """
    title = content.strip()
    # Clean text quotes
    clean_text = content.replace('"', '').replace("'", '').strip()

    # Title extraction
    title_match = re.search(r'(?:need to|must|should|please|have to|task:?)\s+([^.\n!?,]+)', clean_text, re.IGNORECASE)
    if title_match:
        extracted_title = title_match.group(1).strip()
        if len(extracted_title) >= 5:
            title = extracted_title.capitalize()
    else:
        title = clean_text[:60].capitalize()

    # Priority extraction
    priority = "MEDIUM"
    lower = clean_text.lower()
    if any(k in lower for k in ["urgent", "critical", "asap", "blocker", "emergency"]):
        priority = "CRITICAL"
    elif any(k in lower for k in ["high priority", "bug", "auth", "security", "fix"]):
        priority = "HIGH"
    elif any(k in lower for k in ["low priority", "whenever", "nice to have", "minor"]):
        priority = "LOW"

    # Deadline / Due Date calculation
    due_date = None
    now = datetime.now()
    if "today" in lower:
        due_date = now.replace(hour=18, minute=0, second=0, microsecond=0)
    elif "tomorrow" in lower:
        due_date = (now + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
    else:
        # Check day of week matching (e.g., 'friday', 'by monday')
        days_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
        for day_name, target_weekday in days_map.items():
            if day_name in lower:
                current_weekday = now.weekday()
                days_ahead = target_weekday - current_weekday
                if days_ahead <= 0:  # Target day already happened this week, move to next week
                    days_ahead += 7
                due_date = (now + timedelta(days=days_ahead)).replace(hour=18, minute=0, second=0, microsecond=0)
                break

    # Assignee resolution: check project members matching mentioned names or words
    assignee_id = None
    members = (
        db.query(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )
    for m in members:
        name_parts = (m.full_name or "").lower().split() + [m.username.lower()]
        for part in name_parts:
            if len(part) >= 3 and part in lower:
                assignee_id = m.id
                break
        if assignee_id:
            break

    return {
        "title": title,
        "priority": priority,
        "due_date": due_date,
        "assignee_id": assignee_id
    }


@router.post("/tasks/{task_id}/discussion/{comment_id}/extract-task-info")
def extract_task_info_from_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    AI NLP Endpoint: Analyzes a discussion message and automatically extracts:
    - Task Title
    - Priority (LOW, MEDIUM, HIGH, CRITICAL)
    - Suggested Assignee (from team members mentioned/referenced)
    - Calculated Due Date (e.g. 'Friday' -> next Friday timestamp)
    """
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    ai_data = parse_ai_extracted_task_details(comment.content, db, task.project_id)

    # Format user info if assigned
    assignee_info = None
    if ai_data["assignee_id"]:
        assignee_user = db.get(User, ai_data["assignee_id"])
        if assignee_user:
            assignee_info = {
                "id": str(assignee_user.id),
                "full_name": assignee_user.full_name or assignee_user.username,
                "username": assignee_user.username
            }

    return {
        "extracted_title": ai_data["title"],
        "extracted_priority": ai_data["priority"],
        "extracted_due_date": ai_data["due_date"].isoformat() if ai_data["due_date"] else None,
        "extracted_assignee": assignee_info,
        "source_content": comment.content
    }


@router.post("/tasks/{task_id}/discussion/{comment_id}/convert-to-task")
async def convert_comment_to_task(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: ConvertTaskPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Converts a discussion message into a brand new task.
    Prevents duplicate conversion if comment has already been converted.
    Supports manual overrides or AI extracted fields (title, priority, assignee_id, due_date).
    """
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.converted_task_id:
        existing_task = db.get(Task, comment.converted_task_id)
        if existing_task:
            return {
                "message": "Message already converted into task",
                "task": {
                    "id": str(existing_task.id),
                    "title": existing_task.title,
                    "status": existing_task.status,
                },
                "comment": serialize_comment(comment)
            }

    # Run AI NLP extraction for default missing fields
    ai_defaults = parse_ai_extracted_task_details(comment.content, db, task.project_id)

    title = payload.title.strip() if payload.title and payload.title.strip() else ai_defaults["title"]
    priority = payload.priority or ai_defaults["priority"]
    assignee_id = payload.assignee_id or ai_defaults["assignee_id"] or comment.author_id

    parsed_due_date = None
    if payload.due_date:
        try:
            parsed_due_date = datetime.fromisoformat(payload.due_date.replace("Z", "+00:00"))
        except Exception:
            parsed_due_date = ai_defaults["due_date"]
    else:
        parsed_due_date = ai_defaults["due_date"]

    new_task = Task(
        id=uuid.uuid4(),
        project_id=task.project_id,
        title=title,
        description=f"Converted from task discussion message:\n\"{comment.content}\"\n\nSource Task: {task.title}",
        status="TODO",
        priority=priority,
        reporter_id=user_id,
        assignee_id=assignee_id,
        due_date=parsed_due_date,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    comment.converted_task_id = new_task.id
    db.commit()
    db.refresh(comment)

    result_data = serialize_comment(comment)

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_CREATED_FROM_COMMENT",
        "task_id": str(task_id),
        "new_task_id": str(new_task.id),
        "comment": result_data,
    })

    return {
        "message": "Message successfully converted to task",
        "task": {
            "id": str(new_task.id),
            "title": new_task.title,
            "status": new_task.status,
            "priority": new_task.priority,
            "due_date": new_task.due_date.isoformat() if new_task.due_date else None,
        },
        "comment": result_data,
    }


@router.post("/tasks/{task_id}/discussion/{comment_id}/link-task")
async def link_existing_task_to_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: LinkTaskPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Links an existing project task to a discussion message.
    """
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    target_task = db.get(Task, payload.target_task_id)
    if not target_task or target_task.project_id != task.project_id:
        raise HTTPException(status_code=404, detail="Target task not found in this project.")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    comment = db.get(TaskComment, comment_id)
    if not comment or comment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.linked_task_id = target_task.id
    db.commit()
    db.refresh(comment)

    result_data = serialize_comment(comment)

    await manager.broadcast(str(task.project_id), {
        "event": "TASK_LINKED_TO_COMMENT",
        "task_id": str(task_id),
        "linked_task_id": str(target_task.id),
        "comment": result_data,
    })

    return {
        "message": "Task linked to comment successfully",
        "linked_task": {
            "id": str(target_task.id),
            "title": target_task.title,
            "status": target_task.status,
        },
        "comment": result_data,
    }


@router.post("/tasks/{task_id}/discussion/attachments")
async def upload_discussion_attachment(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    # Validate that storage service is configured
    if not storage_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service is not configured on the server. Please set SUPABASE_URL and SUPABASE_SECRET_KEY."
        )

    contents = await file.read()
    file_size = len(contents)

    # Validate file size and prohibited executable extensions
    try:
        storage_service.validate_file_safety(file.filename or "", file_size, file.content_type)
    except FileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Generate non-colliding, traversal-safe storage path
    storage_path = storage_service.generate_storage_path(task.project_id, task.id, file.filename or "attachment")

    # Upload file object to Supabase Storage
    try:
        storage_service.upload_file(storage_path, contents, file.content_type)
    except (StorageConfigurationError, StorageOperationError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {str(e)}"
        )

    # Generate short-lived signed URL for immediate client preview
    try:
        signed_url = storage_service.create_signed_url(storage_path, expires_in=3600)
    except Exception:
        signed_url = storage_path

    attachment = CommentAttachment(
        id=uuid.uuid4(),
        comment_id=None,  # Unlinked until user posts comment with attachment_ids
        file_name=storage_service.sanitize_filename(file.filename or "attachment"),
        file_url=storage_path,
        file_size_bytes=file_size,
        mime_type=file.content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return {
        "id": str(attachment.id),
        "file_name": attachment.file_name,
        "file_url": signed_url,
        "storage_key": storage_path,
        "file_size_bytes": attachment.file_size_bytes,
        "mime_type": attachment.mime_type,
    }


@router.get("/tasks/{task_id}/discussion/attachments/{attachment_id}/download")
def get_attachment_download_url(
    task_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    check_project_membership(db, user_id, task.project_id)

    attachment = db.get(CommentAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not storage_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service is not configured on the server."
        )

    try:
        signed_url = storage_service.create_signed_url(attachment.file_url, expires_in=3600)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate download URL: {str(e)}"
        )

    return {
        "attachment_id": str(attachment.id),
        "file_name": attachment.file_name,
        "download_url": signed_url,
        "expires_in": 3600,
    }

