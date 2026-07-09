from pydantic import BaseModel, Field

class StaffBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class StaffCreate(StaffBase):
    password: str = Field(..., min_length=6)
    role: str = Field(..., description="Role must be admin, dept_head, or security")

class StaffLogin(BaseModel):
    username: str
    password: str

class StaffResponse(StaffBase):
    id: int
    role: str

    class Config:
        from_attributes = True
