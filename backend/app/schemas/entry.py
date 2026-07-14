from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_serializer

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

    @field_serializer('scanned_at')
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()
        
class EntryDetailResponse(BaseModel):
    message: str
    entry: EntryResponse
    user_name: str
    user_type: str
    register_number: str
    admission_number: Optional[str]
    photo_url: Optional[str]
    department: Optional[str]
