import os
import sys
from sqlalchemy.orm import Session

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, SessionLocal, engine
from app.models.staff import Staff
from app.models.user import User
from app.auth.security import hash_password

def seed_database():
    print("[*] Re-creating database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Staff Accounts
        print("[*] Seeding staff accounts...")
        staff_accounts = [
            {"username": "example", "password": "example", "role": "admin"},
            {"username": "security1", "password": "securitypassword", "role": "security"},
            {"username": "security2", "password": "securitypassword", "role": "security"},
            {"username": "security3", "password": "securitypassword", "role": "security"},
            {"username": "security4", "password": "securitypassword", "role": "security"},
            {"username": "security5", "password": "securitypassword", "role": "security"},
            {"username": "depthead_cs", "password": "cspassword", "role": "dept_head"},
            {"username": "depthead_ee", "password": "eepassword", "role": "dept_head"},
        ]
        
        for sa in staff_accounts:
            existing = db.query(Staff).filter(Staff.username == sa["username"]).first()
            if not existing:
                new_staff = Staff(
                    username=sa["username"],
                    password_hash=hash_password(sa["password"]),
                    role=sa["role"]
                )
                db.add(new_staff)
                print(f"[+] Created staff user: {sa['username']} (Role: {sa['role']}, Password: {sa['password']})")
            else:
                print(f"[-] Staff user {sa['username']} already exists.")
        
        db.commit()

       
        print("[*] Seeding finished successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"[!] Database seed failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
