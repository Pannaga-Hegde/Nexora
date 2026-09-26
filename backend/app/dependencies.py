import uuid
from typing import Dict, Any, Optional
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import (
    decode_access_token,
    COOKIE_NAME,
    CSRF_COOKIE_NAME,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def verify_csrf_token(request: Request):
    """
    Enforces double-submit CSRF token validation on state-changing requests (POST, PUT, PATCH, DELETE)
    when cookie-based authentication is used.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # Check if request is authenticated via HttpOnly cookie
    auth_cookie = request.cookies.get(COOKIE_NAME)
    if not auth_cookie:
        # Not using ambient cookie authentication (e.g. testing with direct Bearer token)
        return

    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get("X-CSRF-Token") or request.headers.get("x-csrf-token")

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed: Missing or invalid CSRF token",
        )


def get_current_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    # Prioritize explicit Authorization header if provided by API client, otherwise use HttpOnly cookie
    if token_header:
        token = token_header
        used_cookie = False
    else:
        token = request.cookies.get(COOKIE_NAME)
        used_cookie = bool(token)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. If authenticated via cookie on state-changing request, enforce CSRF
    if used_cookie:
        verify_csrf_token(request)

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("mfa_pending"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incomplete authentication: multi-factor authentication challenge pending",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "system_role": user.system_role
    }


def require_admin_user(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Enforces server-side admin role check and mandatory admin MFA enrollment."""
    if current_user.get("system_role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative privileges required",
        )

    from app.services.mfa_service import mfa_service
    if not mfa_service.is_mfa_enabled(str(current_user["id"]), db=db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA required: Administrators must enroll in and enable multi-factor authentication.",
        )
    return current_user


def verify_project_membership(
    db: Session,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
):
    from app.models import ProjectMember
    membership = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not a member of this project",
        )
    return membership

