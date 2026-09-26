"""
RFC 6238 COMPLIANT TOTP & MFA ENGINE (POSTGRESQL / SQLALCHEMY PERSISTENCE)

Implements standard Time-Based One-Time Passwords (TOTP) without external packages:
- Cryptographic HMAC-SHA1 over 30-second intervals (RFC 6238 / RFC 4226)
- Base32 secret generation and otpauth:// provisioning URIs
- Database-backed encrypted secret persistence via PostgreSQL / SQLAlchemy UserMFA table
- Single-use hashed recovery codes (SHA-256) with per-code consumption tracking
- MFA challenge single-use tracking (JTI invalidation)
- Key derivation from production environment secret (MFA_ENCRYPTION_KEY or SECRET_KEY)
"""

import os
import json
import time
import struct
import base64
import hmac
import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.auth import SECRET_KEY
from app.database import SessionLocal
from app.models import UserMFA


def _get_encryption_key() -> bytes:
    """
    Derives 256-bit encryption key for MFA secret persistence.
    In production environments (ENVIRONMENT=production or prod), MFA_ENCRYPTION_KEY MUST
    be explicitly configured to ensure cryptographic separation from SECRET_KEY.
    In development/testing environments, safe domain-separated derivation from SECRET_KEY is permitted.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    env_mfa_key = os.getenv("MFA_ENCRYPTION_KEY")
    if env in ("production", "prod"):
        if not env_mfa_key or not env_mfa_key.strip():
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: MFA_ENCRYPTION_KEY environment variable "
                "must be explicitly configured in production. Fallback to SECRET_KEY is strictly "
                "prohibited in production to ensure cryptographic key isolation."
            )
        return hashlib.sha256(env_mfa_key.strip().encode("utf-8")).digest()

    if env_mfa_key and env_mfa_key.strip():
        return hashlib.sha256(env_mfa_key.strip().encode("utf-8")).digest()
    return hashlib.sha256(f"nexora-mfa-encryption-v1:{SECRET_KEY}".encode("utf-8")).digest()


def validate_mfa_configuration() -> None:
    """Validates on startup that MFA key management prerequisites are fulfilled."""
    _get_encryption_key()


def _encrypt_secret(plain_secret: str) -> str:
    """Encrypts raw TOTP secret using PBKDF2/HMAC-SHA256 keystream with 16-byte random salt."""
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", _get_encryption_key(), salt, 10000)
    plain_bytes = plain_secret.encode("utf-8")
    keystream = bytearray()
    counter = 0
    while len(keystream) < len(plain_bytes):
        keystream.extend(hmac.new(key, struct.pack(">I", counter), hashlib.sha256).digest())
        counter += 1
    cipher_bytes = bytes(p ^ k for p, k in zip(plain_bytes, keystream[:len(plain_bytes)]))
    return base64.b64encode(salt + cipher_bytes).decode("utf-8")


def _decrypt_secret(encrypted_secret_b64: str) -> str:
    """Decrypts ciphertext back to plain TOTP secret."""
    raw = base64.b64decode(encrypted_secret_b64.encode("utf-8"))
    salt, cipher_bytes = raw[:16], raw[16:]
    key = hashlib.pbkdf2_hmac("sha256", _get_encryption_key(), salt, 10000)
    keystream = bytearray()
    counter = 0
    while len(keystream) < len(cipher_bytes):
        keystream.extend(hmac.new(key, struct.pack(">I", counter), hashlib.sha256).digest())
        counter += 1
    plain_bytes = bytes(c ^ k for c, k in zip(cipher_bytes, keystream[:len(cipher_bytes)]))
    return plain_bytes.decode("utf-8")


def _get_db_session(db: Optional[Session] = None) -> Tuple[Session, bool]:
    if db is not None:
        return db, False
    return SessionLocal(), True


class MFAService:
    def __init__(self):
        # In-memory tracking of consumed challenge JTIs to ensure single-use challenges
        self._consumed_jtis: set = set()

    def consume_challenge_jti(self, jti: str) -> bool:
        """Returns True if JTI was unconsumed and is now consumed. Returns False if already consumed."""
        if not jti:
            return False
        if jti in self._consumed_jtis:
            return False
        self._consumed_jtis.add(jti)
        return True

    @staticmethod
    def generate_totp_secret() -> str:
        """Generates a standard 20-byte Base32 secret string (160 bits)."""
        raw_bytes = secrets.token_bytes(20)
        return base64.b32encode(raw_bytes).decode("utf-8").rstrip("=")

    @staticmethod
    def get_provisioning_uri(username: str, secret: str, issuer: str = "Nexora") -> str:
        """Constructs an otpauth:// provisioning URI for QR code generation."""
        clean_user = username.strip()
        clean_secret = secret.strip().replace(" ", "").upper()
        return f"otpauth://totp/{issuer}:{clean_user}?secret={clean_secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

    @staticmethod
    def calculate_totp(secret: str, time_step: int = 30, for_time: Optional[float] = None) -> str:
        """RFC 6238 / RFC 4226 reference implementation."""
        pad_len = (8 - len(secret) % 8) % 8
        key = base64.b32decode(secret + ("=" * pad_len), casefold=True)
        now = time.time() if for_time is None else for_time
        counter = int(now // time_step)
        msg = struct.pack(">Q", counter)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        offset = h[19] & 15
        truncated = struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF
        code = truncated % 1000000
        return f"{code:06d}"

    @classmethod
    def generate_totp_code(cls, secret: str, for_time: Optional[float] = None) -> str:
        return cls.calculate_totp(secret, for_time=for_time)

    def verify_totp_code(self, secret: str, code: str, window: int = 1) -> bool:
        """Validates code across current time step +/- window."""
        clean_code = str(code).strip()
        if not clean_code.isdigit() or len(clean_code) != 6:
            return False
        now = time.time()
        for offset_step in range(-window, window + 1):
            check_time = now + (offset_step * 30)
            if self.calculate_totp(secret, for_time=check_time) == clean_code:
                return True
        return False

    @staticmethod
    def generate_recovery_codes(count: int = 8) -> Tuple[List[str], List[str]]:
        """Generates formatted recovery codes and their SHA-256 hashes."""
        plain_codes = []
        hashed_codes = []
        for _ in range(count):
            c = f"{secrets.token_hex(4)}-{secrets.token_hex(4)}".upper()
            plain_codes.append(c)
            h = hashlib.sha256(c.encode("utf-8")).hexdigest()
            hashed_codes.append(h)
        return plain_codes, hashed_codes

    def is_mfa_enabled(self, user_id: str, db: Optional[Session] = None) -> bool:
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            record = session.get(UserMFA, user_uuid)
            return bool(record and record.is_enabled)
        except Exception:
            return False
        finally:
            if should_close:
                session.close()

    def setup_enrollment(self, user_id: str, username: str, db: Optional[Session] = None) -> Tuple[str, str]:
        """Creates or resets pending enrollment secret in PostgreSQL/database."""
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            secret = self.generate_totp_secret()
            uri = self.get_provisioning_uri(username, secret)
            record = session.get(UserMFA, user_uuid)
            encrypted = _encrypt_secret(secret)
            if not record:
                record = UserMFA(
                    user_id=user_uuid,
                    is_enabled=False,
                    pending_secret=encrypted,
                )
                session.add(record)
            else:
                record.pending_secret = encrypted
                record.updated_at = datetime.utcnow()
            session.commit()
            return secret, uri
        finally:
            if should_close:
                session.close()

    def confirm_enrollment(self, user_id: str, code: str, db: Optional[Session] = None) -> Optional[List[str]]:
        """Verifies code against pending enrollment. If valid, enables MFA and persists recovery code hashes."""
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            record = session.get(UserMFA, user_uuid)
            if not record or not record.pending_secret:
                return None
            secret = _decrypt_secret(record.pending_secret)
            if not self.verify_totp_code(secret, code):
                return None

            plain_recovery, hashed_recovery = self.generate_recovery_codes(8)
            recovery_list = [{"hash": h, "consumed": False} for h in hashed_recovery]
            record.is_enabled = True
            record.encrypted_secret = record.pending_secret
            record.pending_secret = None
            record.recovery_codes = json.dumps(recovery_list)
            record.updated_at = datetime.utcnow()
            session.commit()
            return plain_recovery
        finally:
            if should_close:
                session.close()

    def verify_user_mfa(self, user_id: str, code: str, db: Optional[Session] = None) -> bool:
        """Verifies either a 6-digit TOTP code or a single-use recovery code against PostgreSQL/database."""
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            record = session.get(UserMFA, user_uuid)
            if not record or not record.is_enabled or not record.encrypted_secret:
                return False

            clean_input = str(code).strip().upper()

            # 1. Try TOTP code
            if clean_input.isdigit() and len(clean_input) == 6:
                secret = _decrypt_secret(record.encrypted_secret)
                if self.verify_totp_code(secret, clean_input):
                    return True

            # 2. Try recovery code
            if record.recovery_codes:
                try:
                    recovery_list = json.loads(record.recovery_codes)
                except Exception:
                    recovery_list = []

                input_hash = hashlib.sha256(clean_input.encode("utf-8")).hexdigest()
                for item in recovery_list:
                    if item.get("hash") == input_hash:
                        if item.get("consumed"):
                            # Reused recovery code: rejected
                            return False
                        # Mark consumed and commit
                        item["consumed"] = True
                        record.recovery_codes = json.dumps(recovery_list)
                        record.updated_at = datetime.utcnow()
                        session.commit()
                        return True
            return False
        finally:
            if should_close:
                session.close()

    def regenerate_recovery_codes(self, user_id: str, db: Optional[Session] = None) -> Optional[List[str]]:
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            record = session.get(UserMFA, user_uuid)
            if not record or not record.is_enabled:
                return None
            plain_recovery, hashed_recovery = self.generate_recovery_codes(8)
            recovery_list = [{"hash": h, "consumed": False} for h in hashed_recovery]
            record.recovery_codes = json.dumps(recovery_list)
            record.updated_at = datetime.utcnow()
            session.commit()
            return plain_recovery
        finally:
            if should_close:
                session.close()

    def disable_mfa(self, user_id: str, db: Optional[Session] = None) -> bool:
        session, should_close = _get_db_session(db)
        try:
            user_uuid = uuid.UUID(str(user_id))
            record = session.get(UserMFA, user_uuid)
            if record:
                record.is_enabled = False
                record.encrypted_secret = None
                record.pending_secret = None
                record.recovery_codes = None
                record.updated_at = datetime.utcnow()
                session.commit()
            return True
        finally:
            if should_close:
                session.close()


mfa_service = MFAService()
