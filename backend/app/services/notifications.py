import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Notification

def trigger_notification(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    message: str,
    link_url: Optional[str] = None
) -> Notification:
    notif = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        title=title,
        message=message,
        is_read=False,
        link_url=link_url
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
