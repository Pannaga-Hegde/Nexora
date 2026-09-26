import uuid
from typing import List, Optional
from pydantic import BaseModel

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
from ..models import User
from ..schemas import (
    UserResponse,
    UserUpdate,
)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get(
    "",
    response_model=List[UserResponse],
)
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return db.scalars(select(User)).all()

class UserMeUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


@router.get("/me", response_model=UserResponse)
def get_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.get(User, current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(
    user_in: UserMeUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.get(User, current_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.username is not None and user_in.username.strip():
        new_username = user_in.username.strip()
        if new_username != user.username:
            existing = db.scalar(select(User).where(User.username == new_username, User.id != user.id))
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
            user.username = new_username
    if user_in.email is not None and user_in.email.strip():
        new_email = user_in.email.strip().lower()
        if new_email != user.email:
            existing = db.scalar(select(User).where(User.email == new_email, User.id != user.id))
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = new_email
    if user_in.password is not None and user_in.password.strip():
        from app.auth import get_password_hash
        user.password_hash = get_password_hash(user_in.password.strip())

    db.commit()
    db.refresh(user)
    return user



@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = uuid.UUID(str(current_user["id"])) if isinstance(current_user["id"], str) else current_user["id"]
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from ..models import (
        ProjectMember,
        Task,
        Notification,
        CommunityPost,
        TaskComment,
        TaskAttachment,
        TaskActivity,
        CalendarEvent,
        AvailabilityBlock,
        Request,
        Message,
    )

    # 1. Project memberships: promote next member to manager if sole manager
    user_memberships = db.scalars(
        select(ProjectMember).where(ProjectMember.user_id == user_id)
    ).all()

    for mem in user_memberships:
        proj_id = mem.project_id
        all_proj_members = db.scalars(
            select(ProjectMember).where(ProjectMember.project_id == proj_id)
        ).all()
        other_members = [m for m in all_proj_members if m.user_id != user_id]
        if mem.project_role in ["manager", "owner", "admin"] and other_members:
            has_another_manager = any(m.project_role in ["manager", "owner", "admin"] for m in other_members)
            if not has_another_manager:
                other_members[0].project_role = "manager"
        db.delete(mem)

    # 2. Nullify task assignees and reporters
    db.query(Task).filter(Task.assignee_id == user_id).update({Task.assignee_id: None})
    db.query(Task).filter(Task.reporter_id == user_id).update({Task.reporter_id: None})

    # 3. Clean up user notifications
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

    # 4. Clean up user availability blocks
    db.query(AvailabilityBlock).filter(AvailabilityBlock.user_id == user_id).delete(synchronize_session=False)

    # 5. Nullify calendar event creator_id
    db.query(CalendarEvent).filter(CalendarEvent.creator_id == user_id).update({CalendarEvent.creator_id: None})

    # 6. Nullify or delete task activities / attachments / requests / comments / messages
    db.query(TaskActivity).filter(TaskActivity.actor_id == user_id).update({TaskActivity.actor_id: None})
    db.query(TaskAttachment).filter(TaskAttachment.uploader_id == user_id).update({TaskAttachment.uploader_id: None})
    db.query(TaskComment).filter(TaskComment.author_id == user_id).update({TaskComment.author_id: None})
    db.query(Request).filter((Request.requester_id == user_id) | (Request.recipient_id == user_id)).delete(synchronize_session=False)
    db.query(Message).filter(Message.sender_id == user_id).update({Message.sender_id: None})

    # 7. Delete community posts authored by the user
    db.query(CommunityPost).filter(CommunityPost.author_id == user_id).delete(synchronize_session=False)

    # 8. Delete user record
    db.delete(user)
    db.commit()

    return {
        "status": "success",
        "message": "User account and all associated personal data have been permanently deleted."
    }


@router.get(
    "/{user_id}",
    response_model=UserResponse,
)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

