from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    register_number = Column(String, unique=True, index=True, nullable=False)
    admission_number = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    photo_url = Column(String, nullable=True)
    type = Column(String, nullable=False)  # 'student' or 'guardian'
    department = Column(String, nullable=True)  # e.g., 'Computer Science', 'Electrical'
    is_aligned = Column(Boolean, default=False, nullable=False)
    
    # Self-referential FK for guardian -> student
    linked_student_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    linked_student = relationship("User", remote_side=[id], backref="linked_guardians")
    entry = relationship("Entry", uselist=False, back_populates="user", cascade="all, delete-orphan")
