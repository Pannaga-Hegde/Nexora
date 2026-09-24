# Re-export from app.dependencies to ensure strict JWT authentication across all entry points
from app.database import get_db
from app.dependencies import get_current_user
