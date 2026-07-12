import re
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.security import get_current_staff_optional
from app.models.staff import Staff
from app.models.user import User
from app.models.entry import Entry
from app.crud.user import get_departments, get_users

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def get_staff_departments(staff: Optional[Staff], db: Session) -> List[str]:
    # Fetch all distinct departments in the DB
    all_depts = [r[0] for r in db.query(User.department).filter(User.department != None).distinct().all() if r[0]]
    
    if not staff or staff.role != "dept_head":
        return all_depts
        
    # Extract department identifier from username (e.g. depthead_cs -> cs)
    dept_code = staff.username.replace("depthead_", "").strip().lower()
    
    # Mapping of department code/acronym to keywords and synonyms
    dept_map = {
        "cs": ["computer science", "cs", "cse"],
        "bca": ["computer application", "bca"],
        "bba": ["business administration", "bba"],
        "ee": ["electrical", "ee", "eee"],
        "ec": ["electronics", "ec", "ece"],
        "me": ["mechanical", "me", "mech"],
        "ce": ["civil", "ce"],
        "physics": ["physics", "phy"],
        "chemistry": ["chemistry", "chem"],
        "maths": ["mathematics", "maths", "math"],
        "mathematics": ["mathematics", "maths", "math"],
        "botany": ["botany", "bot"],
        "zoology": ["zoology", "zoo"],
        "psychology": ["psychology", "psy"],
        "english": ["english", "eng"],
        "economics": ["economics", "eco"],
        "commerce": ["commerce", "com", "b.com", "m.com"],
        "history": ["history", "hist"],
        "criminology": ["criminology", "crim"],
        "forensic": ["forensic", "foren"],
        "social": ["social work", "msw"],
        "visual": ["visual communication", "viscom"],
        "multimedia": ["multimedia", "media"],
        "data": ["data science", "data"],
    }
    
    keywords = dept_map.get(dept_code, [dept_code])
    
    matched = []
    for dept in all_depts:
        dept_lower = dept.lower()
        # 1. Direct keyword/substring match
        if any(kw in dept_lower for kw in keywords):
            matched.append(dept)
            continue
            
        # 2. Acronym/Initial matching (e.g. "B SC COMPUTER SCIENCE" -> BSCS, BSC, CS)
        # Strip brackets for initials calculation (e.g., [ AIDED ])
        dept_core = re.sub(r"\[.*?\]", "", dept_lower).strip()
        words = [w for w in re.split(r'[^a-zA-Z0-9]+', dept_core) if w and w not in ('of', 'and', 'in', 'with')]
        initials = "".join(w[0] for w in words)
        
        if dept_code in initials or initials.endswith(dept_code):
            matched.append(dept)
            continue
            
    # Fallback 1: substring match
    if not matched:
        matched = [d for d in all_depts if dept_code in d.lower()]
        
    # Fallback 2: returns all if still no match (failsafe)
    if not matched:
        return all_depts
        
    return matched

@router.get("/stats")
def get_dashboard_stats(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_staff: Optional[Staff] = Depends(get_current_staff_optional)
):
    allowed_depts = get_staff_departments(current_staff, db)
    
    # Restrict department filter for dept heads
    if current_staff and current_staff.role == "dept_head":
        if department:
            if department not in allowed_depts:
                department_filter = allowed_depts
            else:
                department_filter = [department]
        else:
            department_filter = allowed_depts
    else:
        department_filter = [department] if department else None

    # Base queries
    total_users_query = db.query(User)
    total_students_query = db.query(User).filter(User.type == "student")
    total_guardians_query = db.query(User).filter(User.type == "guardian")
    
    entered_users_query = db.query(Entry).join(User, Entry.user_id == User.id)
    entered_students_query = db.query(Entry).join(User, Entry.user_id == User.id).filter(User.type == "student")
    entered_guardians_query = db.query(Entry).join(User, Entry.user_id == User.id).filter(User.type == "guardian")
    
    # Filter by department if provided
    if department_filter is not None:
        total_users_query = total_users_query.filter(User.department.in_(department_filter))
        total_students_query = total_students_query.filter(User.department.in_(department_filter))
        total_guardians_query = total_guardians_query.filter(User.department.in_(department_filter))
        
        entered_users_query = entered_users_query.filter(User.department.in_(department_filter))
        entered_students_query = entered_students_query.filter(User.department.in_(department_filter))
        entered_guardians_query = entered_guardians_query.filter(User.department.in_(department_filter))
        
    total_count = total_users_query.count()
    student_count = total_students_query.count()
    guardian_count = total_guardians_query.count()
    
    entered_count = entered_users_query.count()
    student_entered_count = entered_students_query.count()
    guardian_entered_count = entered_guardians_query.count()

    if not current_staff or current_staff.role == "dept_head":
        return {
            "total_registered": student_count,
            "total_entered": student_entered_count,
            "students_registered": student_count,
            "students_entered": student_entered_count,
            "guardians_registered": 0,
            "guardians_entered": 0,
            "attendance_rate": round((student_entered_count / student_count * 100), 1) if student_count > 0 else 0.0
        }

    return {
        "total_registered": total_count,
        "total_entered": entered_count,
        "students_registered": student_count,
        "students_entered": student_entered_count,
        "guardians_registered": guardian_count,
        "guardians_entered": guardian_entered_count,
        "attendance_rate": round((entered_count / total_count * 100), 1) if total_count > 0 else 0.0
    }

@router.get("/departments")
def get_all_departments(
    db: Session = Depends(get_db),
    current_staff: Optional[Staff] = Depends(get_current_staff_optional)
):
    allowed = get_staff_departments(current_staff, db)
    return {"departments": allowed}

@router.get("/users")
def get_dashboard_users(
    department: Optional[str] = Query(None),
    entered: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("admission"), # "admission" or "time"
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_staff: Optional[Staff] = Depends(get_current_staff_optional)
):
    query = db.query(User).outerjoin(Entry, User.id == Entry.user_id)
    allowed_depts = get_staff_departments(current_staff, db)
    
    # Staff (dept heads) should ONLY see students
    if current_staff and current_staff.role == "dept_head":
        query = query.filter(User.type == "student")
        if department:
            if department not in allowed_depts:
                department_filter = allowed_depts
            else:
                department_filter = [department]
        else:
            department_filter = allowed_depts
    else:
        if type:
            query = query.filter(User.type == type)
        department_filter = [department] if department else None
        
    if department_filter is not None:
        query = query.filter(User.department.in_(department_filter))
        
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
            (User.admission_number.ilike(search_filter)) 
        )
        
    total_filtered = query.count()
    
    # Sorting logic
    if sort_by == "time":
        query = query.order_by(Entry.scanned_at.desc().nulls_last(), User.register_number.asc())
    else:
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
