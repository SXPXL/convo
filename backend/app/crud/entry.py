import datetime
from sqlalchemy.orm import Session
from app.models.entry import Entry
from app.models.user import User

def get_entry_by_user_id(db: Session, user_id: int) -> Entry | None:
    return db.query(Entry).filter(Entry.user_id == user_id).first()

def create_entry(db: Session, user_id: int, staff_id: int) -> Entry:
    db_entry = Entry(
        user_id=user_id,
        scanned_by=staff_id,
        scanned_at=datetime.datetime.utcnow(),
        status="entered"
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry
