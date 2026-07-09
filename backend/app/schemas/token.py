from pydantic import BaseModel
from typing import Optional

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str

class TokenPayload(BaseModel):
    sub: str  # username or user_id
    role: str
    exp: int

class TokenRefreshRequest(BaseModel):
    refresh_token: Optional[str] = None
