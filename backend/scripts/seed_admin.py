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
            {"username": "admin", "password": "adminpassword", "role": "admin"},
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

        # 2. Seed Mock Student and Guardian Data
        print("[*] Seeding mock students and guardians...")
        mock_students = [
            # Computer Science Department
            {"admission_number": "CS202601", "name": "Emily Watson", "type": "student", "dept": "Computer Science", "seat": "S-0001", "photo": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop", "phone": "+15550192834"},
            {"admission_number": "CS202602", "name": "Marcus Aurelius", "type": "student", "dept": "Computer Science", "seat": "S-0002", "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop", "phone": "+15550293847"},
            {"admission_number": "CS202603", "name": "Sophia Martinez", "type": "student", "dept": "Computer Science", "seat": "S-0003", "photo": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop", "phone": "+15550384756"},
            # Electrical Engineering Department
            {"admission_number": "EE202601", "name": "David Kim", "type": "student", "dept": "Electrical Engineering", "seat": "S-0004", "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop", "phone": "+15550475638"},
            {"admission_number": "EE202602", "name": "Aisha Rahman", "type": "student", "dept": "Electrical Engineering", "seat": "S-0005", "photo": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop", "phone": "+15550563829"}
        ]
        
        student_id_map = {}
        for ms in mock_students:
            existing = db.query(User).filter(User.admission_number == ms["admission_number"]).first()
            if not existing:
                new_student = User(
                    register_number=ms["admission_number"],  # Set register_number to match admission_number for seed
                    admission_number=ms["admission_number"],
                    name=ms["name"],
                    type=ms["type"],
                    department=ms["dept"],
                    seat_number=ms["seat"],
                    photo_url=ms["photo"],
                    phone=ms.get("phone")
                )
                db.add(new_student)
                db.commit()
                db.refresh(new_student)
                student_id_map[ms["admission_number"]] = new_student.id
                print(f"[+] Created student: {ms['name']} ({ms['admission_number']})")
            else:
                existing.phone = ms.get("phone")
                if not existing.register_number:
                    existing.register_number = ms["admission_number"]
                student_id_map[ms["admission_number"]] = existing.id
                print(f"[-] Student {ms['admission_number']} already exists. Updated phone: {existing.phone}")
                
        # Seed Mock Guardians linked to students
        mock_guardians = [
            {"admission_number": "CS2026011", "name": "John Watson", "type": "guardian", "seat": "S-0001-G1", "photo": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop", "link_to": "CS202601"},
            {"admission_number": "CS2026012", "name": "Mary Watson", "type": "guardian", "seat": "S-0001-G2", "photo": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop", "link_to": "CS202601"},
            {"admission_number": "CS2026021", "name": "Commodus Aurelius", "type": "guardian", "seat": "S-0002-G1", "photo": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop", "link_to": "CS202602"},
            {"admission_number": "EE2026011", "name": "Jin Kim", "type": "guardian", "seat": "S-0004-G1", "photo": "https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150&h=150&fit=crop", "link_to": "EE202601"}
        ]
        
        for mg in mock_guardians:
            existing = db.query(User).filter(User.admission_number == mg["admission_number"]).first()
            if not existing:
                student_id = student_id_map.get(mg["link_to"])
                if student_id:
                    new_guardian = User(
                        register_number=mg["admission_number"],  # Set register_number
                        admission_number=mg["admission_number"],
                        name=mg["name"],
                        type=mg["type"],
                        seat_number=mg["seat"],
                        photo_url=mg["photo"],
                        linked_student_id=student_id
                    )
                    db.add(new_guardian)
                    print(f"[+] Created guardian: {mg['name']} ({mg['admission_number']}) linked to {mg['link_to']}")
            else:
                if not existing.register_number:
                    existing.register_number = mg["admission_number"]
                print(f"[-] Guardian {mg['admission_number']} already exists.")
                
        db.commit()
        print("[*] Seeding finished successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"[!] Database seed failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
