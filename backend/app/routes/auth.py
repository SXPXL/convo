import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.crud.staff import authenticate_staff, get_staff_by_username
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_staff
)
from app.models.token import RefreshToken
from app.models.staff import Staff
from app.schemas.staff import StaffLogin, StaffResponse
from app.schemas.token import TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    # Set Access Token Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        path="/"
    )
    # Set Refresh Token Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        path="/"
    )

@router.post("/login", response_model=StaffResponse)
def login(login_data: StaffLogin, response: Response, db: Session = Depends(get_db)):
    staff = authenticate_staff(db, login_data.username, login_data.password)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    # Generate tokens
    access_token = create_access_token(data={"sub": staff.username, "role": staff.role})
    refresh_token_str = create_refresh_token(data={"sub": staff.username})
    
    # Save refresh token in DB
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_refresh_token = RefreshToken(
        token=refresh_token_str,
        staff_id=staff.id,
        expires_at=expires_at
    )
    db.add(db_refresh_token)
    db.commit()
    
    # Set in cookies
    set_auth_cookies(response, access_token, refresh_token_str)
    
    return staff

@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token_str = request.cookies.get("refresh_token")
    if not refresh_token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token cookie."
        )
    
    # Decode and check refresh token
    payload = decode_token(refresh_token_str, settings.JWT_REFRESH_SECRET)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )
    
    # Find token in DB
    db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token_str).first()
    if not db_token or db_token.revoked or db_token.expires_at < datetime.datetime.utcnow():
        # Token is invalid, revoked, or expired.
        # If it was revoked, someone might be attempting a replay attack, so optionally flag/revoke all user's tokens.
        if db_token and db_token.revoked:
            # Revoke all tokens for this staff member as a safety precaution
            db.query(RefreshToken).filter(RefreshToken.staff_id == db_token.staff_id).update({"revoked": True})
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is expired, revoked, or invalid."
        )
    
    # Get staff member
    username = payload.get("sub")
    staff = get_staff_by_username(db, username)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found."
        )
        
    # Rotate token: Mark current as revoked
    db_token.revoked = True
    
    # Generate new tokens
    new_access_token = create_access_token(data={"sub": staff.username, "role": staff.role})
    new_refresh_token_str = create_refresh_token(data={"sub": staff.username})
    
    # Save new refresh token
    new_expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_db_token = RefreshToken(
        token=new_refresh_token_str,
        staff_id=staff.id,
        expires_at=new_expires_at
    )
    db.add(new_db_token)
    db.commit()
    
    # Set cookies
    set_auth_cookies(response, new_access_token, new_refresh_token_str)
    
    return {"message": "Token refreshed successfully"}

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token_str = request.cookies.get("refresh_token")
    if refresh_token_str:
        # Revoke token in DB
        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token_str).first()
        if db_token:
            db_token.revoked = True
            db.commit()
            
    # Clear cookies
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=StaffResponse)
def get_me(current_staff: Staff = Depends(get_current_staff)):
    return current_staff
