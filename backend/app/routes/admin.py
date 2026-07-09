from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import io
import csv
import re
from app.database import get_db
from app.auth.security import RoleChecker
from app.models.staff import Staff
from app.models.user import User
from app.models.entry import Entry
from app.schemas.staff import StaffCreate, StaffResponse
from app.schemas.user import UserCreate, UserResponse
from app.crud.staff import create_staff, get_staff_by_username
from app.crud.user import create_user, get_user_by_register_number, get_user_by_admission_number
from app.utils.qr import generate_qr_code_base64

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Enforce admin only access
admin_auth = RoleChecker(allowed_roles=["admin"])

@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def register_staff_member(
    staff_in: StaffCreate,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(admin_auth)
):
    existing_staff = get_staff_by_username(db, staff_in.username)
    if existing_staff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered."
        )
    return create_staff(db, staff_in)

@router.post("/user", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(admin_auth)
):
    existing_user = get_user_by_register_number(db, user_in.register_number)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Register number already exists."
        )
        
    # If it's a guardian, verify linked student exists
    if user_in.type == "guardian" and user_in.linked_student_id:
        student = db.query(User).filter(User.id == user_in.linked_student_id).first()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Linked student with ID {user_in.linked_student_id} not found."
            )
            
    db_user = create_user(db, user_in)
    return db_user

@router.get("/user/{register_number}/qr")
def get_user_qr(
    register_number: str,
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(admin_auth)
):
    user = get_user_by_register_number(db, register_number)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with register number '{register_number}' not found."
        )
        
    qr_base64 = generate_qr_code_base64(user.register_number)
    return {
        "register_number": user.register_number,
        "name": user.name,
        "qr_code_url": qr_base64
    }

@router.post("/upload-participants")
def upload_participants(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(admin_auth)
):
    filename = file.filename.lower()
    content = file.file.read()
    
    rows = []
    try:
        if filename.endswith(".csv"):
            text_content = content.decode("utf-8-sig", errors="ignore")
            csv_reader = csv.DictReader(io.StringIO(text_content))
            headers = csv_reader.fieldnames
            normalized_headers = {h.strip().lower(): h for h in headers} if headers else {}
            
            for row in csv_reader:
                cleaned_row = {k.strip().lower(): v.strip() if v else "" for k, v in row.items() if k}
                rows.append(cleaned_row)
        elif filename.endswith(".xlsx"):
            import openpyxl
            wb = openpyxl.load_workbook(filename=io.BytesIO(content), data_only=True)
            sheet = wb.active
            header_row = [cell.value for cell in sheet[1]]
            normalized_headers = {}
            for idx, val in enumerate(header_row):
                if val is not None:
                    normalized_headers[str(val).strip().lower()] = idx
            
            for row_idx in range(2, sheet.max_row + 1):
                row_values = [sheet.cell(row=row_idx, column=col_idx).value for col_idx in range(1, len(header_row) + 1)]
                if not any(row_values):
                    continue
                cleaned_row = {}
                for k_lower, col_idx in normalized_headers.items():
                    if col_idx < len(row_values):
                        val = row_values[col_idx]
                        cleaned_row[k_lower] = str(val).strip() if val is not None else ""
                rows.append(cleaned_row)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a .csv or .xlsx file."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(e)}"
        )
        
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no data."
        )

    # Match column headers robustly
    keys = rows[0].keys()
    col_admission = None
    col_register = None
    col_student_name = None
    col_guardian_1 = None
    col_guardian_2 = None
    col_course = None
    
    for k in keys:
        if "1st" in k or "first" in k or "guardian 1" in k or "parent 1" in k or "participant (parent/guardian/relative)" in k:
            if not col_guardian_1 or "1st" in k or "1" in k:
                col_guardian_1 = k
        elif "2nd" in k or "second" in k or "guardian 2" in k or "parent 2" in k or "participant (parent/guardian/relative)" in k:
            if not col_guardian_2 or "2nd" in k or "2" in k:
                col_guardian_2 = k
        elif "admission" in k or "admn" in k or "adm no" in k:
            col_admission = k
        elif "register" in k or "reg" in k:
            col_register = k
        elif "course" in k or "dept" in k or "department" in k:
            col_course = k
        elif "student name" in k or "student_name" in k:
            col_student_name = k
            
    # Fallbacks for student name
    if not col_student_name:
        for k in keys:
            if "student" in k:
                col_student_name = k
                break
    if not col_student_name:
        for k in keys:
            if "name" in k and k != col_guardian_1 and k != col_guardian_2:
                col_student_name = k
                break
                
    if not col_register or not col_student_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Required columns not found. Detected columns: {list(keys)}. We need at least one column for Student Name and one for Register No."
        )

    # Determine starting seat index
    existing_seats = db.query(User.seat_number).filter(User.seat_number.like("S-%")).all()
    max_seat_num = 0
    for (s_num,) in existing_seats:
        if s_num:
            match = re.match(r"^S-(\d+)", s_num)
            if match:
                val = int(match.group(1))
                if val > max_seat_num:
                    max_seat_num = val
                    
    seat_counter = max_seat_num + 1
    
    imported_students = 0
    imported_guardians = 0
    errors = []
    
    for idx, r in enumerate(rows):
        try:
            reg_no = r.get(col_register, "").strip()
            name = r.get(col_student_name, "").strip()
            admn_no = r.get(col_admission, "").strip() if col_admission else ""
            course_val = r.get(col_course, "").strip() if col_course else ""
            g1_val = r.get(col_guardian_1, "").strip() if col_guardian_1 else ""
            g2_val = r.get(col_guardian_2, "").strip() if col_guardian_2 else ""
            
            if not reg_no or not name:
                continue
                
            # Extract department name (upto square bracket '[')
            dept_name = course_val
            if "[" in course_val:
                dept_name = course_val.split("[")[0].strip()
            elif "(" in course_val:
                dept_name = course_val.split("(")[0].strip()
            else:
                dept_name = course_val.strip()
                
            # Check if Student already exists in DB
            student = db.query(User).filter(User.register_number == reg_no).first()
            if not student:
                seat_no = f"S-{seat_counter:04d}"
                seat_counter += 1
                
                student = User(
                    register_number=reg_no,
                    admission_number=admn_no if admn_no else None,
                    name=name,
                    type="student",
                    department=dept_name if dept_name else None,
                    seat_number=seat_no
                )
                db.add(student)
                db.commit()
                db.refresh(student)
                imported_students += 1
            else:
                if admn_no:
                    student.admission_number = admn_no
                if name:
                    student.name = name
                if dept_name:
                    student.department = dept_name
                db.commit()
                db.refresh(student)
                
            # Guardian 1
            if g1_val:
                g1_reg = f"{reg_no}-G1"
                g1_admn = f"{admn_no}-G1" if admn_no else None
                g1_seat = f"{student.seat_number}-G1" if student.seat_number else None
                
                g1 = db.query(User).filter(User.register_number == g1_reg).first()
                if not g1:
                    g1 = User(
                        register_number=g1_reg,
                        admission_number=g1_admn,
                        name=g1_val,
                        type="guardian",
                        seat_number=g1_seat,
                        linked_student_id=student.id
                    )
                    db.add(g1)
                    imported_guardians += 1
                else:
                    g1.name = g1_val
                    g1.seat_number = g1_seat
                db.commit()
                
            # Guardian 2
            if g2_val:
                g2_reg = f"{reg_no}-G2"
                g2_admn = f"{admn_no}-G2" if admn_no else None
                g2_seat = f"{student.seat_number}-G2" if student.seat_number else None
                
                g2 = db.query(User).filter(User.register_number == g2_reg).first()
                if not g2:
                    g2 = User(
                        register_number=g2_reg,
                        admission_number=g2_admn,
                        name=g2_val,
                        type="guardian",
                        seat_number=g2_seat,
                        linked_student_id=student.id
                    )
                    db.add(g2)
                    imported_guardians += 1
                else:
                    g2.name = g2_val
                    g2.seat_number = g2_seat
                db.commit()
                
        except Exception as row_error:
            db.rollback()
            errors.append(f"Row {idx+2}: {str(row_error)}")
            
    return {
        "status": "success" if not errors else "partial_success",
        "message": f"Successfully imported {imported_students} students and {imported_guardians} guardians.",
        "imported_students": imported_students,
        "imported_guardians": imported_guardians,
        "errors": errors
    }

@router.post("/reset-entries")
def reset_all_entries(
    db: Session = Depends(get_db),
    current_staff: Staff = Depends(admin_auth)
):
    # Clear all records from Entries table
    db.query(Entry).delete()
    db.commit()
    return {"message": "All check-in entries have been successfully cleared."}
