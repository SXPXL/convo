from typing import Optional, List
from pydantic import BaseModel, Field

class UserBase(BaseModel):
    register_number: str = Field(..., description="Unique register number")
    admission_number: Optional[str] = Field(None, description="Optional admission number")
    name: str = Field(...)
    type: str = Field(..., description="'student' or 'guardian'")
    department: Optional[str] = Field(None, description="Department name for students")
    linked_student_id: Optional[int] = Field(None, description="ID of linked student if this is a guardian")

class UserCreate(UserBase):
    photo_url: Optional[str] = None

class UserUpdate(BaseModel):
    register_number: Optional[str] = None
    admission_number: Optional[str] = None
    name: Optional[str] = None
    photo_url: Optional[str] = None
    department: Optional[str] = None
    linked_student_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    photo_url: Optional[str] = None
    entered: bool = False
    scanned_at: Optional[str] = None

    class Config:
        from_attributes = True
