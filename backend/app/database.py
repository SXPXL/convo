from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool  # 1. Import NullPool

from app.config import settings

# 2. Update engine to use NullPool
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool  # Disables local pooling; relies entirely on Neon's PgBouncer
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()