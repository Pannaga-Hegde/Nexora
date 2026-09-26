"""
AUTHENTICATION & SECURITY RATE LIMITER (SLIDING WINDOW)

Provides in-memory sliding-window rate limiting for sensitive endpoints:
- /auth/token (Login): Max 5 failed attempts per 15 minutes per IP/account
- /auth/register: Max 5 attempts per hour per IP
- /auth/mfa/verify: Max 5 failed attempts per 15 minutes per account

Note: In-memory limiting is designed for single-instance or local deployments.
Distributed multi-instance deployments require Redis or equivalent shared infrastructure.
"""

import time
from typing import Dict, List, Tuple
from collections import defaultdict


class SlidingWindowRateLimiter:
    def __init__(self):
        # Maps bucket_key -> List[timestamp_float]
        self._history: Dict[str, List[float]] = defaultdict(list)

    def _cleanup(self, key: str, window_seconds: int, now: float):
        cutoff = now - window_seconds
        self._history[key] = [t for t in self._history[key] if t > cutoff]

    def check(self, key: str, max_attempts: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Returns (is_allowed, retry_after_seconds). Does NOT record an attempt.
        """
        now = time.time()
        self._cleanup(key, window_seconds, now)
        timestamps = self._history[key]
        if len(timestamps) >= max_attempts:
            oldest = timestamps[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, retry_after
        return True, 0

    def record_attempt(self, key: str, max_attempts: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Records an attempt and returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        self._cleanup(key, window_seconds, now)
        if len(self._history[key]) >= max_attempts:
            oldest = self._history[key][0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, retry_after
        self._history[key].append(now)
        return True, 0

    def reset(self, key: str):
        """Clears recorded history for a key (e.g. on successful login)."""
        if key in self._history:
            del self._history[key]

    def clear(self):
        """Clears all history across all keys."""
        self._history.clear()


auth_rate_limiter = SlidingWindowRateLimiter()
