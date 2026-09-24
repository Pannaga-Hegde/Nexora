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
    UserCreate,
    UserResponse,
    UserUpdate,
)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    existing_user = db.scalar(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email or username already exists",
        )

    # Note: In production, hash password before storing (e.g., passlib / bcrypt)
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        password_hash=user_data.password,  # placeholder hash
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

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

