import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, CommunityPost
from app.dependencies import get_current_user

router = APIRouter(prefix="/community", tags=["Community"])

MAX_COMMUNITY_TITLE_LENGTH = 255
MAX_COMMUNITY_CONTENT_LENGTH = 20000
MAX_COMMUNITY_CATEGORY_LENGTH = 100


class CommunityPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=MAX_COMMUNITY_TITLE_LENGTH)
    content: str = Field(..., min_length=1, max_length=MAX_COMMUNITY_CONTENT_LENGTH)
    category: Optional[str] = Field("General", max_length=MAX_COMMUNITY_CATEGORY_LENGTH)


class CommunityPostResponse(BaseModel):
    id: str
    title: str
    content: str
    category: str
    author_id: Optional[str] = None
    author_name: str
    author_role: str
    likes_count: int
    created_at: str


def serialize_post(post: CommunityPost) -> dict:
    author_name = "Unknown User"
    author_role = "Member"
    if post.author:
        author_name = post.author.full_name or post.author.username
        author_role = post.author.system_role.capitalize() if post.author.system_role else "Member"

    return {
        "id": str(post.id),
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "author_id": str(post.author_id) if post.author_id else None,
        "author_name": author_name,
        "author_role": author_role,
        "likes_count": post.likes_count,
        "created_at": post.created_at.isoformat() if post.created_at else "",
    }


@router.get("/posts", response_model=List[CommunityPostResponse])
def get_community_posts(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    List all community posts persisted in PostgreSQL, ordered newest first.
    """
    posts = (
        db.query(CommunityPost)
        .order_by(CommunityPost.created_at.desc())
        .all()
    )
    return [serialize_post(p) for p in posts]


@router.post("/posts", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED)
def create_community_post(
    post_in: CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new community post persisted in PostgreSQL with authenticated user as author.
    """
    user_id = uuid.UUID(str(current_user["id"]))
    
    new_post = CommunityPost(
        id=uuid.uuid4(),
        author_id=user_id,
        title=post_in.title.strip(),
        content=post_in.content.strip(),
        category=post_in.category or "General",
        likes_count=0,
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return serialize_post(new_post)


@router.post("/posts/{post_id}/like")
def like_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Increment like counter on a persisted post.
    """
    try:
        post_uuid = uuid.UUID(post_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Post not found")

    post = db.get(CommunityPost, post_uuid)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.likes_count += 1
    db.commit()
    return {"status": "success", "likes_count": post.likes_count}


@router.delete("/posts/{post_id}", status_code=status.HTTP_200_OK)
def delete_community_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Take down / delete a community post. Only the author is authorized to delete their own post.
    """
    try:
        post_uuid = uuid.UUID(post_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Post not found")

    post = db.get(CommunityPost, post_uuid)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_id = uuid.UUID(str(current_user["id"]))
    if post.author_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only take down your own posts."
        )

    db.delete(post)
    db.commit()

    return {
        "status": "success",
        "message": "Post taken down successfully.",
        "id": str(post_id),
    }
