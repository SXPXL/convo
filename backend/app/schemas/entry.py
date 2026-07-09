from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class EntryBase(BaseModel):
    user_id: int

class EntryCreate(EntryBase):
    pass

class EntryResponse(EntryBase):
    id: int
    scanned_at: datetime
    scanned_by: Optional[int]
    status: str

    class Config:
        from_attributes = True
        
class EntryDetailResponse(BaseModel):
    message: str
    entry: EntryResponse
    user_name: str
    user_type: str
    register_number: str
    admission_number: Optional[str]
    seat_number: Optional[str]
    photo_url: Optional[str]
    department: Optional[str]
