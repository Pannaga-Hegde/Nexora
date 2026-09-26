import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Response

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Please configure a secure random 32+ byte string in your .env file or deployment environment."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

COOKIE_NAME = "nexora_auth"
CSRF_COOKIE_NAME = "nexora_csrf"
COOKIE_MAX_AGE = 86400  # 24 hours
COOKIE_PATH = "/"
COOKIE_SAMESITE = "none"


def is_cookie_secure() -> bool:
    env = os.getenv("ENVIRONMENT", "development").lower()
    explicit = os.getenv("COOKIE_SECURE")
    if explicit is not None and explicit.strip():
        return explicit.strip().lower() in ("true", "1", "yes")
    return env in ("production", "prod")


def generate_csrf_token() -> str:
    return secrets.token_hex(32)


def set_auth_cookies(response: Response, token: str, csrf_token: Optional[str] = None) -> str:
    secure = is_cookie_secure()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
    )
    if csrf_token is None:
        csrf_token = generate_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=COOKIE_MAX_AGE,
        httponly=False,  # Readable by frontend for X-CSRF-Token submission
        secure=secure,
        samesite=COOKIE_SAMESITE,
        path=COOKIE_PATH,
    )
    return csrf_token


def clear_auth_cookies(response: Response):
    secure = is_cookie_secure()
    response.delete_cookie(
        key=COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite=COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=False,
        secure=secure,
        samesite=COOKIE_SAMESITE,
    )

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
