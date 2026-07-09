from sqlalchemy.orm import Session
from app.models.staff import Staff
from app.schemas.staff import StaffCreate
from app.auth.security import hash_password, verify_password

def get_staff_by_id(db: Session, staff_id: int):
    return db.query(Staff).filter(Staff.id == staff_id).first()

def get_staff_by_username(db: Session, username: str):
    return db.query(Staff).filter(Staff.username == username).first()

def create_staff(db: Session, staff: StaffCreate) -> Staff:
    hashed_pwd = hash_password(staff.password)
    db_staff = Staff(
        username=staff.username,
        password_hash=hashed_pwd,
        role=staff.role
    )
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff

def authenticate_staff(db: Session, username: str, password: str) -> Staff | None:
    staff = get_staff_by_username(db, username)
    if not staff:
        return None
    if not verify_password(password, staff.password_hash):
        return None
    return staff
