from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'security', 'dept_head', 'admin'

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="staff", cascade="all, delete-orphan")
    scanned_entries = relationship("Entry", back_populates="scanner", foreign_keys="[Entry.scanned_by]")
