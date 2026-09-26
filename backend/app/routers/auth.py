import uuid
import secrets
from datetime import timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    set_auth_cookies,
    clear_auth_cookies,
    generate_csrf_token,
    CSRF_COOKIE_NAME,
    is_cookie_secure,
)
from app.dependencies import get_current_user, require_admin_user
from app.services.rate_limiter import auth_rate_limiter
from app.services.mfa_service import mfa_service

router = APIRouter(prefix="/auth", tags=["auth"])


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "cookie"
    user: dict
    mfa_required: bool = False
    mfa_token: Optional[str] = None


class MFAVerifyPayload(BaseModel):
    mfa_token: str
    code: str


class MFAActionPayload(BaseModel):
    code: Optional[str] = None
    totp_code: Optional[str] = None
    password: Optional[str] = None

    def get_code(self) -> Optional[str]:
        return self.code or self.totp_code


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    full_name: Optional[str] = None
    system_role: str
    mfa_enabled: bool = False


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_in: UserRegister,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_key = f"register:{client_ip}"
    allowed, retry_after = auth_rate_limiter.record_attempt(rate_key, max_attempts=5, window_seconds=3600)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    # Check if username or email already exists
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        id=uuid.uuid4(),
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name or user_in.username,
        password_hash=get_password_hash(user_in.password),
        system_role="student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "username": user.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "system_role": user.system_role,
        },
    }


@router.post("/token")
def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    clean_identifier = form_data.username.strip().lower()
    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_key = f"login:{clean_identifier}:{client_ip}"

    # Check rate limit before evaluating password
    allowed, retry_after = auth_rate_limiter.check(rate_key, max_attempts=5, window_seconds=900)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        auth_rate_limiter.record_attempt(rate_key, max_attempts=5, window_seconds=900)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Successful password verification: clear login failure bucket
    auth_rate_limiter.reset(rate_key)

    # Check MFA requirement
    user_str_id = str(user.id)
    if mfa_service.is_mfa_enabled(user_str_id, db=db):
        challenge_jti = secrets.token_hex(16)
        mfa_challenge_token = create_access_token(
            {"sub": user_str_id, "mfa_pending": True, "jti": challenge_jti},
            expires_delta=timedelta(minutes=5),
        )
        return {
            "access_token": None,
            "token_type": "cookie",
            "mfa_required": True,
            "mfa_token": mfa_challenge_token,
            "user": {
                "id": str(user.id),
                "username": user.username,
            },
        }

    token = create_access_token({"sub": user_str_id, "username": user.username})
    set_auth_cookies(response, token)

    return {
        "access_token": None,
        "token_type": "cookie",
        "mfa_required": False,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "system_role": user.system_role,
        },
    }


@router.post("/mfa/verify", response_model=TokenResponse)
def verify_mfa_challenge(
    payload: MFAVerifyPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token_data = decode_access_token(payload.mfa_token)
    if not token_data or not token_data.get("mfa_pending"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA session challenge",
        )

    challenge_jti = token_data.get("jti")
    if not challenge_jti or challenge_jti in mfa_service._consumed_jtis:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA challenge has expired, been consumed, or is invalid",
        )

    user_id_str = token_data.get("sub")
    rate_key = f"mfa:{user_id_str}"
    allowed, retry_after = auth_rate_limiter.check(rate_key, max_attempts=5, window_seconds=900)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed MFA verification attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.get(User, uuid.UUID(user_id_str))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    is_valid = mfa_service.verify_user_mfa(user_id_str, payload.code, db=db)
    if not is_valid:
        auth_rate_limiter.record_attempt(rate_key, max_attempts=5, window_seconds=900)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA authentication code or recovery code",
        )

    # MFA verified: mark challenge JTI as consumed so it cannot be reused
    mfa_service.consume_challenge_jti(challenge_jti)
    auth_rate_limiter.reset(rate_key)
    token = create_access_token({"sub": str(user.id), "username": user.username})
    set_auth_cookies(response, token)

    return {
        "access_token": None,
        "token_type": "cookie",
        "mfa_required": False,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "system_role": user.system_role,
        },
    }


@router.post("/mfa/setup")
def setup_mfa(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = str(current_user["id"])
    secret, uri = mfa_service.setup_enrollment(user_id, current_user["username"], db=db)
    return {
        "secret": secret,
        "provisioning_uri": uri,
        "message": "Scan this provisioning URI or enter the secret into your authenticator app.",
    }


@router.post("/mfa/enable")
def enable_mfa(
    payload: MFAActionPayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = str(current_user["id"])
    code = payload.get_code()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is required.",
        )
    recovery_codes = mfa_service.confirm_enrollment(user_id, code, db=db)
    if not recovery_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP verification code. MFA enrollment failed.",
        )
    return {
        "status": "enabled",
        "message": "MFA has been successfully activated for your account.",
        "recovery_codes": recovery_codes,
    }


@router.post("/mfa/disable")
def disable_mfa(
    payload: MFAActionPayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = str(current_user["id"])
    # Privileged accounts cannot disable MFA
    if current_user.get("system_role") == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative accounts cannot disable MFA due to security policy.",
        )

    code = payload.get_code()
    password = payload.password

    # Validate either valid TOTP/recovery code OR account password
    verified = False
    if code and mfa_service.verify_user_mfa(user_id, code):
        verified = True
    elif password:
        user = db.get(User, uuid.UUID(user_id))
        if user and verify_password(password, user.password_hash):
            verified = True

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or MFA code. Unable to disable MFA.",
        )

    mfa_service.disable_mfa(user_id)
    return {"status": "disabled", "message": "MFA has been disabled."}


@router.post("/mfa/recovery-codes")
def regenerate_recovery_codes(
    payload: MFAActionPayload,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = str(current_user["id"])
    code = payload.get_code()
    verified = False
    if code and mfa_service.verify_user_mfa(user_id, code):
        verified = True
    elif payload.password:
        user = db.get(User, uuid.UUID(user_id))
        if user and verify_password(payload.password, user.password_hash):
            verified = True

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code or password. Authorization required to generate new recovery codes.",
        )

    new_codes = mfa_service.regenerate_recovery_codes(user_id)
    if not new_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled on this account.",
        )
    return {
        "status": "success",
        "message": "Old recovery codes have been invalidated.",
        "recovery_codes": new_codes,
    }


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"status": "success", "message": "Successfully logged out."}


@router.get("/csrf-token")
def get_csrf_token(response: Response):
    token = generate_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=86400,
        httponly=False,
        secure=is_cookie_secure(),
        samesite="none",
        path="/",
    )
    return {"csrf_token": token}


@router.get("/me", response_model=UserResponse)
def get_me(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id_str = str(current_user["id"])
    mfa_enabled = mfa_service.is_mfa_enabled(user_id_str, db=db)
    return {
        **current_user,
        "mfa_enabled": mfa_enabled,
    }


@router.get("/admin/privileged-action")
def admin_privileged_action(
    admin_user: dict = Depends(require_admin_user),
):
    return {
        "status": "ok",
        "message": "Privileged action allowed",
        "admin_id": str(admin_user["id"]),
    }
