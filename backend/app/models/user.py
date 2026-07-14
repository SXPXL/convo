from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    register_number = Column(String, unique=True, index=True, nullable=False)
    admission_number = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    _photo_url = Column("photo_url", String, nullable=True)

    @property
    def photo_url(self) -> str:
        # If the user is aligned and there is a stored photo_url in the database, return it
        if self.is_aligned and self._photo_url:
            return self._photo_url
            
        # Otherwise, dynamically resolve it based on register_number
        if not self.register_number:
            return None
            
        import os
        from app.config import settings
        
        base_url = settings.PHOTO_BASE_URL.rstrip('/')
        
        # If it's an external URL, just return it directly
        if base_url.startswith("http://") or base_url.startswith("https://"):
            return f"{base_url}/{self.register_number}.jpg"
            
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        if base_url.startswith("/static/"):
            rel_path = base_url.replace("/static/", "static/", 1)
            photos_dir = os.path.join(base_dir, rel_path)
        else:
            photos_dir = os.path.join(base_dir, "static", "photos")
        
        # Check standard photo extensions: .jpg, .png, .jpeg, .webp
        for ext in [".jpg", ".png", ".jpeg", ".webp"]:
            # Check lowercase
            filename = f"{self.register_number}{ext}"
            if os.path.exists(os.path.join(photos_dir, filename)):
                return f"{base_url}/{filename}"
            # Check uppercase
            filename_up = f"{self.register_number.upper()}{ext}"
            if os.path.exists(os.path.join(photos_dir, filename_up)):
                return f"{base_url}/{filename_up}"
                
        # Fallback to student photo for guardians
        if "-" in self.register_number:
            student_reg = self.register_number.split("-")[0]
            for ext in [".jpg", ".png", ".jpeg", ".webp"]:
                filename = f"{student_reg}{ext}"
                if os.path.exists(os.path.join(photos_dir, filename)):
                    return f"{base_url}/{filename}"
                filename_up = f"{student_reg.upper()}{ext}"
                if os.path.exists(os.path.join(photos_dir, filename_up)):
                    return f"{base_url}/{filename_up}"
                    
        return None

    @photo_url.setter
    def photo_url(self, value):
        self._photo_url = value
    type = Column(String, nullable=False)  # 'student' or 'guardian'
    department = Column(String, nullable=True)  # e.g., 'Computer Science', 'Electrical'
    is_aligned = Column(Boolean, default=False, nullable=False)
    
    # Self-referential FK for guardian -> student
    linked_student_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    linked_student = relationship("User", remote_side=[id], backref="linked_guardians")
    entry = relationship("Entry", uselist=False, back_populates="user", cascade="all, delete-orphan")
