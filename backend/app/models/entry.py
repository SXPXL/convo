import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Entry(Base):
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    scanned_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    scanned_by = Column(Integer, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="entered", nullable=False)  # 'entered'

    # Relationships
    user = relationship("User", back_populates="entry")
    scanner = relationship("Staff", back_populates="scanned_entries", foreign_keys=[scanned_by])
