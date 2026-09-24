# Re-export from app.database to ensure consistent environment configuration
from app.database import SQLALCHEMY_DATABASE_URL, engine, SessionLocal, Base, get_db
