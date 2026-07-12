import datetime
import time
from typing import List, Optional
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.orm import Session
import jwt
import bcrypt

from app.config import settings
from app.database import get_db
from app.models.staff import Staff
from app.models.token import RefreshToken

# Setup password hashing directly with bcrypt library
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire_time = int(time.time() + expires_delta.total_seconds())
    else:
        expire_time = int(time.time() + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode.update({"exp": expire_time, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire_time = int(time.time() + expires_delta.total_seconds())
    else:
        expire_time = int(time.time() + settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
    to_encode.update({"exp": expire_time, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_token(token: str, secret: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token

async def get_current_staff(request: Request, db: Session = Depends(get_db)) -> Staff:
    # Extract access token from Cookie (or Fallback Authorization Header)
    token = request.cookies.get("access_token")
    
    if not token:
        # Fallback to Authorization Header if cookies not present (e.g. for development testing)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token, settings.JWT_SECRET)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing credentials.",
        )

    # Fetch staff
    staff = db.query(Staff).filter(Staff.username == username).first()
    if staff is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    return staff

async def get_current_staff_optional(request: Request, db: Session = Depends(get_db)) -> Optional[Staff]:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        return None
        
    payload = decode_token(token, settings.JWT_SECRET)
    if payload is None or payload.get("type") != "access":
        return None
        
    username = payload.get("sub")
    if username is None:
        return None
        
    return db.query(Staff).filter(Staff.username == username).first()


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_staff: Staff = Depends(get_current_staff)) -> Staff:
        if current_staff.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_staff
