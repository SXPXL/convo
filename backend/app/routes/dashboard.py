from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.security import RoleChecker
from app.models.staff import Staff
from app.models.user import User
from app.models.entry import Entry
from app.crud.user import get_departments, get_users

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Dashboard access is allowed for dept_head and admin
dashboard_auth = RoleChecker(allowed_roles=["dept_head", "admin"])

@router.get("/stats")
def get_dashboard_stats(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(dashboard_auth)
):
    # Base queries
    total_users_query = db.query(User)
    total_students_query = db.query(User).filter(User.type == "student")
    total_guardians_query = db.query(User).filter(User.type == "guardian")
    
    entered_users_query = db.query(Entry).join(User, Entry.user_id == User.id)
    entered_students_query = db.query(Entry).join(User, Entry.user_id == User.id).filter(User.type == "student")
    entered_guardians_query = db.query(Entry).join(User, Entry.user_id == User.id).filter(User.type == "guardian")
    
    # Filter by department if provided
    if department:
        total_users_query = total_users_query.filter(User.department == department)
        total_students_query = total_students_query.filter(User.department == department)
        total_guardians_query = total_guardians_query.filter(User.department == department)
        
        entered_users_query = entered_users_query.filter(User.department == department)
        entered_students_query = entered_students_query.filter(User.department == department)
        entered_guardians_query = entered_guardians_query.filter(User.department == department)
        
    total_count = total_users_query.count()
    student_count = total_students_query.count()
    guardian_count = total_guardians_query.count()
    
    entered_count = entered_users_query.count()
    student_entered_count = entered_students_query.count()
    guardian_entered_count = entered_guardians_query.count()
    
    # Seats info (fixed seats)
    # Assumes capacity is equal to total registered students/guardians for this department or absolute capacity
    total_seats = total_count
    occupied_seats = entered_count
    remaining_seats = total_seats - occupied_seats
    
    return {
        "total_registered": total_count,
        "total_entered": entered_count,
        "students_registered": student_count,
        "students_entered": student_entered_count,
        "guardians_registered": guardian_count,
        "guardians_entered": guardian_entered_count,
        "total_seats": total_seats,
        "occupied_seats": occupied_seats,
        "remaining_seats": remaining_seats,
        "attendance_rate": round((entered_count / total_count * 100), 1) if total_count > 0 else 0.0
    }

@router.get("/departments")
def get_all_departments(
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(dashboard_auth)
):
    departments = get_departments(db)
    return {"departments": departments}

@router.get("/users")
def get_dashboard_users(
    department: Optional[str] = Query(None),
    entered: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("admission"), # "admission" or "time"
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(dashboard_auth)
):
    query = db.query(User).outerjoin(Entry, User.id == Entry.user_id)
    
    # Staff (dept heads) should ONLY see students
    if current_staff.role == "dept_head":
        query = query.filter(User.type == "student")
    elif type:
        query = query.filter(User.type == type)
        
    if department:
        query = query.filter(User.department == department)
        
    if entered is not None:
        if entered:
            query = query.filter(Entry.id != None)
        else:
            query = query.filter(Entry.id == None)
            
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.name.ilike(search_filter)) | 
            (User.register_number.ilike(search_filter)) | 
            (User.admission_number.ilike(search_filter)) | 
            (User.seat_number.ilike(search_filter))
        )
        
    total_filtered = query.count()
    
    # Sorting logic
    if sort_by == "time":
        # Order by check-in time descending (nulls last) to place recent check-ins at the absolute top
        query = query.order_by(Entry.scanned_at.desc().nulls_last(), User.register_number.asc())
    else:
        # Default: order by User.register_number ASC
        query = query.order_by(User.register_number.asc())
        
    users_with_entries = (
        query.offset(skip)
        .limit(limit)
        .all()
    )
    
    user_list = []
    for user in users_with_entries:
        entry = db.query(Entry).filter(Entry.user_id == user.id).first()
        
        linked_student_name = None
        if user.type == "guardian" and user.linked_student:
            linked_student_name = user.linked_student.name
            
        user_list.append({
            "id": user.id,
            "register_number": user.register_number,
            "admission_number": user.admission_number,
            "name": user.name,
            "photo_url": user.photo_url,
            "type": user.type,
            "department": user.department,
            "seat_number": user.seat_number,
            "phone": user.phone,
            "entered": entry is not None,
            "scanned_at": entry.scanned_at.isoformat() if entry else None,
            "linked_student_name": linked_student_name
        })
        
    return {
        "total": total_filtered,
        "users": user_list,
        "skip": skip,
        "limit": limit
    }
