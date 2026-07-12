from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from app.models.user import User
from app.models.entry import Entry
from app.schemas.user import UserCreate, UserUpdate

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_register_number(db: Session, register_number: str) -> Optional[User]:
    return db.query(User).filter(User.register_number == register_number).first()

def get_user_by_admission_number(db: Session, admission_number: str) -> Optional[User]:
    return db.query(User).filter(User.admission_number == admission_number).first()

def get_users(
    db: Session,
    type: Optional[str] = None,
    department: Optional[str] = None,
    entered: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[User]:
    query = db.query(User)
    
    if type:
        query = query.filter(User.type == type)
        
    if department:
        query = query.filter(User.department == department)
        
    if entered is not None:
        if entered:
            # Must have an entry record
            query = query.join(Entry, User.id == Entry.user_id)
        else:
            # Must NOT have an entry record
            query = query.outerjoin(Entry, User.id == Entry.user_id).filter(Entry.id == None)
            
    return query.offset(skip).limit(limit).all()

def get_departments(db: Session) -> List[str]:
    # Returns distinct departments list for the dropdown filter
    results = db.query(User.department).filter(User.department != None).distinct().all()
    return [r[0] for r in results if r[0]]

def create_user(db: Session, user: UserCreate) -> User:
    db_user = User(
        register_number=user.register_number,
        admission_number=user.admission_number,
        name=user.name,
        photo_url=user.photo_url,
        type=user.type,
        department=user.department,
        linked_student_id=user.linked_student_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, db_user: User, user_update: UserUpdate) -> User:
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int) -> bool:
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False
