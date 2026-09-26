import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db, SessionLocal
from app.models import Conversation, Message, User, Project, ProjectMember
from app.dependencies import get_current_user
from app.websockets import manager

router = APIRouter(prefix="/projects/{project_id}/chat", tags=["Project Chat"])

MAX_CHAT_MESSAGE_LENGTH = 4000

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_CHAT_MESSAGE_LENGTH)

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: Optional[str]
    sender_name: str
    content: str
    created_at: str

def get_or_create_conversation(db: Session, project_id: uuid.UUID) -> Conversation:
    conv = db.scalar(
        select(Conversation).where(Conversation.project_id == project_id)
    )
    if not conv:
        conv = Conversation(
            id=uuid.uuid4(),
            project_id=project_id,
            name="General Channel"
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv

@router.get("/messages", response_model=List[MessageResponse])
def get_project_messages(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    conv = get_or_create_conversation(db, project_id)
    
    messages = (
        db.query(Message, User.full_name, User.username)
        .outerjoin(User, Message.sender_id == User.id)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    result = []
    for msg, full_name, username in messages:
        sender_label = full_name or username or "System"
        result.append({
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "sender_id": str(msg.sender_id) if msg.sender_id else None,
            "sender_name": sender_label,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        })
    return result

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_project_message(
    project_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    conv = get_or_create_conversation(db, project_id)

    msg = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        sender_id=user_id,
        content=payload.content.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    sender_name = current_user.get("full_name") or current_user.get("username") or "Team Member"

    response_data = {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id),
        "sender_name": sender_name,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }

    # Broadcast via WebSocket manager
    await manager.broadcast(str(project_id), {
        "event": "new_message",
        "data": response_data
    })

    return response_data


@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_project_message(
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_id = uuid.UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"]
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project"
        )

    conv = get_or_create_conversation(db, project_id)
    msg = db.get(Message, message_id)
    if not msg or msg.conversation_id != conv.id:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.sender_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only delete your own messages."
        )

    db.delete(msg)
    db.commit()

    # Broadcast deletion via WebSocket
    await manager.broadcast(str(project_id), {
        "event": "message_deleted",
        "data": {
            "message_id": str(message_id),
            "conversation_id": str(conv.id),
        }
    })

    return {
        "status": "success",
        "message": "Message deleted successfully",
        "id": str(message_id)
    }

