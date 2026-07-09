from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.security import RoleChecker
from app.models.staff import Staff
from app.crud.user import get_user_by_register_number
from app.crud.entry import get_entry_by_user_id, create_entry
from app.schemas.entry import EntryDetailResponse
from app.utils.ws_manager import manager

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

# Only security and admin roles are allowed to access scanner endpoints
scanner_auth = RoleChecker(allowed_roles=["security", "admin"])

@router.get("/user/{register_number}")
def get_scanned_user_details(
    register_number: str,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(scanner_auth)
):
    user = get_user_by_register_number(db, register_number)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with register number '{register_number}' not found."
        )
        
    entry = get_entry_by_user_id(db, user.id)
    
    # Return details
    linked_student_name = None
    if user.type == "guardian" and user.linked_student:
        linked_student_name = user.linked_student.name
        
    return {
        "id": user.id,
        "register_number": user.register_number,
        "admission_number": user.admission_number,
        "name": user.name,
        "photo_url": user.photo_url,
        "type": user.type,
        "department": user.department,
        "seat_number": user.seat_number,
        "entered": entry is not None,
        "scanned_at": entry.scanned_at.isoformat() if entry else None,
        "linked_student_name": linked_student_name
    }

@router.post("/entry/{register_number}", response_model=EntryDetailResponse)
async def register_entry(
    register_number: str,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(scanner_auth)
):
    user = get_user_by_register_number(db, register_number)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with register number '{register_number}' not found."
        )
        
    # Check if already entered
    existing_entry = get_entry_by_user_id(db, user.id)
    if existing_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Duplicate entry detected! {user.name} has already entered."
        )
        
    # Create entry
    entry = create_entry(db, user.id, current_staff.id)
    
    # Broadcast check-in event to all connected dashboard WebSockets
    await manager.broadcast({
        "type": "checkin",
        "data": {
            "register_number": user.register_number,
            "admission_number": user.admission_number,
            "name": user.name,
            "entered": True,
            "scanned_at": entry.scanned_at.isoformat(),
            "department": user.department,
            "type": user.type,
            "seat_number": user.seat_number,
            "phone": user.phone
        }
    })
    
    # Return verification response
    return EntryDetailResponse(
        message=f"Access Granted. Check-in successful for {user.name}.",
        entry={
            "user_id": entry.user_id,
            "id": entry.id,
            "scanned_at": entry.scanned_at,
            "scanned_by": entry.scanned_by,
            "status": entry.status
        },
        user_name=user.name,
        user_type=user.type,
        register_number=user.register_number,
        admission_number=user.admission_number,
        seat_number=user.seat_number,
        photo_url=user.photo_url,
        department=user.department
    )
