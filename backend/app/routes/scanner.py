from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.auth.security import RoleChecker
from app.models.staff import Staff
from app.models.user import User
from app.crud.user import get_user_by_register_number
from app.crud.entry import get_entry_by_user_id, create_entry
from app.schemas.entry import EntryDetailResponse
from app.utils.ws_manager import manager

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

# Only security and admin roles are allowed to access scanner endpoints
scanner_auth = RoleChecker(allowed_roles=["security", "admin"])

class AlignGuestsRequest(BaseModel):
    scanned_register_number: str
    selected_name: str
    selected_photo_url: str

@router.get("/user/{register_number}")
def get_scanned_user_details(
    register_number: str,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(scanner_auth)
):
    user = get_user_by_register_number(db, register_number)
    
    # Fallback lookup: if guest -2 is scanned but not found, try -1
    if not user and register_number.endswith("-2"):
        fallback_reg = register_number[:-2] + "-1"
        user = get_user_by_register_number(db, fallback_reg)
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with register number '{register_number}' not found."
        )
        
    # Check for real-time guest photo/name alignment requirement
    if user.type == "guardian" and not user.is_aligned:
        student = user.linked_student
        if student:
            guardians = db.query(User).filter(
                (User.linked_student_id == student.id) & (User.type == "guardian")
            ).all()
            
            # Interactive alignment is only triggerable if there are exactly 2 guardians
            if len(guardians) == 2:
                other_guardian = guardians[1] if guardians[0].id == user.id else guardians[0]
                other_entry = get_entry_by_user_id(db, other_guardian.id)
                current_entry = get_entry_by_user_id(db, user.id)
                
                # If neither has checked in yet, prompt for alignment
                if not other_entry and not current_entry:
                    return {
                        "alignment_required": True,
                        "scanned_user": {
                            "register_number": user.register_number,
                            "type": user.type
                        },
                        "guardians": [
                            {
                                "register_number": g.register_number,
                                "name": g.name,
                                "photo_url": g.photo_url
                            } for g in guardians
                        ],
                        "student_name": student.name,
                        "admission_number": student.admission_number
                    }

    entry = get_entry_by_user_id(db, user.id)
    
    # Return details
    linked_student_name = None
    if user.type == "guardian" and user.linked_student:
        linked_student_name = user.linked_student.name
        
    return {
        "alignment_required": False,
        "id": user.id,
        "register_number": user.register_number,
        "admission_number": user.admission_number,
        "name": user.name,
        "photo_url": user.photo_url,
        "type": user.type,
        "department": user.department,
        "entered": entry is not None,
        "scanned_at": (entry.scanned_at.isoformat() + "Z") if entry else None,
        "linked_student_name": linked_student_name
    }

@router.post("/entry/{register_number}", response_model=EntryDetailResponse)
async def register_entry(
    register_number: str,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(scanner_auth)
):
    user = get_user_by_register_number(db, register_number)
    
    # Fallback lookup: if guest -2 is scanned but not found, try -1
    if not user and register_number.endswith("-2"):
        fallback_reg = register_number[:-2] + "-1"
        user = get_user_by_register_number(db, fallback_reg)
        
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
            "photo_url": user.photo_url,
            "entered": True,
            "scanned_at": entry.scanned_at.isoformat() + "Z",
            "department": user.department,
            "type": user.type,
            "scanned_by_username": current_staff.username
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
        photo_url=user.photo_url,
        department=user.department
    )

@router.post("/align-guests")
async def align_guests(
    payload: AlignGuestsRequest,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(scanner_auth)
):
    # Fetch scanned user
    user = get_user_by_register_number(db, payload.scanned_register_number)
    if not user or user.type != "guardian":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scanned guest not found or is not a guardian."
        )
        
    student = user.linked_student
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest is not linked to any student."
        )
        
    # Get the 2 guardians
    guardians = db.query(User).filter(
        (User.linked_student_id == student.id) & (User.type == "guardian")
    ).all()
    
    if len(guardians) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alignment requires exactly 2 guardians."
        )
        
    g1, g2 = guardians[0], guardians[1]
    other_user = g2 if g1.id == user.id else g1
    
    # Check if either has already entered
    if get_entry_by_user_id(db, g1.id) or get_entry_by_user_id(db, g2.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot align: one of the guardians has already checked in."
        )
        
    # Store original names and photos to prevent reference mutation overwrites
    g1_orig_name = g1.name
    g1_orig_photo = g1.photo_url
    g2_orig_name = g2.name
    g2_orig_photo = g2.photo_url
    
    # Assign selected name and photo to current scanned user
    user.name = payload.selected_name
    user.photo_url = payload.selected_photo_url
    user.is_aligned = True
    
    # Assign remaining name and photo to other user
    remaining_name = g2_orig_name if g1_orig_name == payload.selected_name else g1_orig_name
    remaining_photo = g2_orig_photo if g1_orig_photo == payload.selected_photo_url else g1_orig_photo
    
    other_user.name = remaining_name
    other_user.photo_url = remaining_photo
    other_user.is_aligned = True
    
    db.commit()
    db.refresh(user)
    db.refresh(other_user)
    
    # Now automatically register the entry (check-in) for the scanned user
    entry = create_entry(db, user.id, current_staff.id)
    
    # Broadcast to websocket
    await manager.broadcast({
        "type": "checkin",
        "data": {
            "register_number": user.register_number,
            "admission_number": user.admission_number,
            "name": user.name,
            "photo_url": user.photo_url,
            "entered": True,
            "scanned_at": entry.scanned_at.isoformat() + "Z",
            "department": user.department,
            "type": user.type,
            "scanned_by_username": current_staff.username
        }
    })
    
    return {
        "status": "success",
        "message": f"Successfully aligned and checked in {user.name}.",
        "entry": {
            "user_id": entry.user_id,
            "id": entry.id,
            "scanned_at": entry.scanned_at.isoformat() + "Z",
            "scanned_by": entry.scanned_by,
            "status": entry.status
        },
        "user_name": user.name,
        "user_type": user.type,
        "register_number": user.register_number,
        "admission_number": user.admission_number,
        "photo_url": user.photo_url
    }
