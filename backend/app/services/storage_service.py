import os
import re
import uuid
from typing import Optional
import requests
from dotenv import load_dotenv

load_dotenv()

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
DEFAULT_BUCKET = "nexora-files"
DEFAULT_SIGNED_URL_EXPIRATION_SECONDS = 3600  # 1 hour

# Prohibited executable / dangerous file extensions
PROHIBITED_EXTENSIONS = {
    "exe", "dll", "bat", "cmd", "sh", "bash", "vbs", "vbe", "js", "jse",
    "wsf", "wsh", "scr", "pif", "com", "jar", "msi", "ps1", "ps2", "psc1",
    "php", "phtml", "php3", "php4", "php5", "asp", "aspx", "jsp", "jspx",
    "cgi", "pl", "pyc", "pyo", "hta", "reg", "inf", "ins",
    "html", "htm", "xhtml", "svg"
}


class StorageConfigurationError(Exception):
    """Raised when Supabase Storage credentials are missing or invalid."""
    pass


class StorageOperationError(Exception):
    """Raised when an upload, download, or signed URL creation fails."""
    pass


class FileValidationError(Exception):
    """Raised when uploaded file fails size, extension, or format validation."""
    pass


class SupabaseStorageService:
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or os.getenv("SUPABASE_URL") or "").rstrip("/")
        self.secret_key = secret_key or os.getenv("SUPABASE_SECRET_KEY") or ""
        self.bucket_name = (
            bucket_name
            or os.getenv("SUPABASE_STORAGE_BUCKET")
            or DEFAULT_BUCKET
        ).strip()

    def is_configured(self) -> bool:
        """Checks if server-side Supabase Storage credentials are configured."""
        return bool(self.supabase_url and self.secret_key)

    def _get_headers(self, content_type: Optional[str] = None) -> dict:
        if not self.is_configured():
            raise StorageConfigurationError(
                "Supabase Storage is not configured on this server. "
                "Please set SUPABASE_URL and SUPABASE_SECRET_KEY."
            )
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "apikey": self.secret_key,
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitizes raw filenames to prevent path traversal, control character injection,
        and illegal filesystem characters.
        """
        if not filename:
            return "attachment"

        # Strip directory components (both Unix / and Windows \)
        basename = os.path.basename(filename.replace("\\", "/"))
        # Strip null bytes and control characters
        basename = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", basename)
        # Normalize and filter to safe characters: alphanumeric, dots, underscores, dashes
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", basename)
        # Prevent hidden / dotfile traversal
        safe_name = safe_name.lstrip(".")
        if not safe_name:
            return "attachment"
        # Truncate length if excessively long
        return safe_name[:150]

    @staticmethod
    def validate_file_safety(filename: str, file_size: int, content_type: Optional[str] = None) -> None:
        """
        Validates file size (1B - 10MB) and rejects prohibited executable extensions.
        """
        if file_size <= 0:
            raise FileValidationError("Uploaded file is empty (0 bytes).")
        if file_size > MAX_FILE_SIZE_BYTES:
            raise FileValidationError(
                f"File size ({file_size / (1024 * 1024):.1f} MB) exceeds maximum allowed limit of 10 MB."
            )

        sanitized = SupabaseStorageService.sanitize_filename(filename)
        ext = sanitized.rsplit(".", 1)[-1].lower() if "." in sanitized else ""
        if ext in PROHIBITED_EXTENSIONS:
            raise FileValidationError(
                f"File extension '.{ext}' is prohibited for security reasons."
            )

    def generate_storage_path(self, project_id: uuid.UUID, task_id: uuid.UUID, filename: str) -> str:
        """
        Generates a non-colliding, traversal-safe storage object key:
        projects/{project_id}/tasks/{task_id}/attachments/{uuid}-{safe_filename}
        """
        safe_name = self.sanitize_filename(filename)
        unique_prefix = uuid.uuid4().hex[:12]
        return f"projects/{project_id}/tasks/{task_id}/attachments/{unique_prefix}-{safe_name}"

    def upload_file(
        self,
        storage_path: str,
        content: bytes,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Uploads an object to the private Supabase Storage bucket.
        Returns the internal storage path.
        """
        if not self.is_configured():
            raise StorageConfigurationError(
                "Supabase Storage credentials are not configured on the server."
            )

        # Normalize content type
        mime = content_type or "application/octet-stream"
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{storage_path}"
        headers = self._get_headers(content_type=mime)
        headers["x-upsert"] = "true"

        try:
            res = requests.post(url, headers=headers, data=content, timeout=30)
            if res.status_code not in (200, 201):
                # Never print or leak service key; only status and sanitized message
                raise StorageOperationError(
                    f"Storage provider returned status {res.status_code} during upload."
                )
            return storage_path
        except requests.RequestException as exc:
            raise StorageOperationError(f"Network error communicating with storage provider: {type(exc).__name__}")

    def create_signed_url(
        self,
        storage_path: str,
        expires_in: int = DEFAULT_SIGNED_URL_EXPIRATION_SECONDS,
    ) -> str:
        """
        Generates a short-lived authenticated signed URL for direct file download.
        """
        if not self.is_configured():
            raise StorageConfigurationError(
                "Supabase Storage credentials are not configured on the server."
            )

        url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket_name}/{storage_path}"
        headers = self._get_headers(content_type="application/json")
        payload = {"expiresIn": expires_in}

        try:
            res = requests.post(url, headers=headers, json=payload, timeout=15)
            if res.status_code != 200:
                raise StorageOperationError(
                    f"Storage provider returned status {res.status_code} during signed URL creation."
                )
            data = res.json()
            signed_url_fragment = data.get("signedURL")
            if not signed_url_fragment:
                raise StorageOperationError("Invalid response from storage provider (missing signedURL).")

            if signed_url_fragment.startswith("http://") or signed_url_fragment.startswith("https://"):
                return signed_url_fragment

            if signed_url_fragment.startswith("/storage/v1/"):
                return f"{self.supabase_url}{signed_url_fragment}"
            elif signed_url_fragment.startswith("/"):
                return f"{self.supabase_url}/storage/v1{signed_url_fragment}"
            else:
                return f"{self.supabase_url}/storage/v1/{signed_url_fragment}"
        except requests.RequestException as exc:
            raise StorageOperationError(f"Network error creating signed URL: {type(exc).__name__}")

    def delete_file(self, storage_path: str) -> bool:
        """
        Deletes an object from the private Supabase Storage bucket.
        """
        if not self.is_configured():
            return False

        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}"
        headers = self._get_headers(content_type="application/json")
        payload = {"prefixes": [storage_path]}

        try:
            res = requests.delete(url, headers=headers, json=payload, timeout=15)
            return res.status_code == 200
        except Exception:
            return False


# Global singleton instance for application use
storage_service = SupabaseStorageService()
