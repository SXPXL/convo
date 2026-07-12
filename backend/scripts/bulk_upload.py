import os
import sys
import argparse
from sqlalchemy.orm import Session

# Add backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cloudinary
import cloudinary.uploader
from app.config import settings
from app.database import SessionLocal, engine
from app.models.user import User

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_bulk_upload(folder_path: str, department_name: str = "General"):
    print(f"[*] Starting bulk upload from folder: {folder_path}")
    print(f"[*] Department: {department_name}")
    
    if not os.path.exists(folder_path):
        print(f"[!] Error: Folder '{folder_path}' does not exist.")
        return
        
    db = next(get_db())
    
    # 1. Gather all files
    all_files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"[*] Found {len(all_files)} images in folder.")
    
    # 2. Sort files by length of filename so that shorter filenames (students, e.g. "CS101")
    # are processed before longer filenames (guardians, e.g. "CS1011" or "CS1012")
    all_files.sort(key=len)
    
    # We will track processed students to link guardians
    processed_students = {}  # {admission_number_lower: student_db_id}
    student_seat_counter = 1
    
    success_count = 0
    error_count = 0
    
    for filename in all_files:
        file_path = os.path.join(folder_path, filename)
        base_name, ext = os.path.splitext(filename)
        filename_key = base_name.lower()
        
        # Determine User Type, Admission Number, and Linked Student
        user_type = "student"
        linked_student_id = None
        admission_number = base_name.upper()
        
        # Check if filename ends with '1' or '2' and if the prefix matches a student we processed
        if len(filename_key) > 1 and filename_key[-1] in ('1', '2'):
            potential_student_key = filename_key[:-1]
            if potential_student_key in processed_students:
                user_type = "guardian"
                linked_student_id = processed_students[potential_student_key]
                print(f"[*] Identified GUARDIAN '{admission_number}' linked to Student ID '{linked_student_id}'")
        
        # Check if already exists in DB
        existing_user = db.query(User).filter(User.admission_number == admission_number).first()
        if existing_user:
            print(f"[-] Skip: User with admission number '{admission_number}' already exists in DB.")
            if user_type == "student":
                processed_students[filename_key] = existing_user.id
            continue
            
        print(f"[*] Uploading {filename} to Cloudinary...")
        try:
            # Upload to Cloudinary under folder 'convocation'
            upload_result = cloudinary.uploader.upload(
                file_path,
                folder="convocation_photos",
                public_id=f"{admission_number}",
                overwrite=True
            )
            photo_url = upload_result.get("secure_url")
            print(f"[+] Uploaded to Cloudinary: {photo_url}")
            
            # Create user in DB
            db_user = User(
                register_number=admission_number, # Mapping to register_number
                admission_number=admission_number,
                name=f"{user_type.capitalize()} of {admission_number}" if user_type == "guardian" else f"Student {admission_number}",
                photo_url=photo_url,
                type=user_type,
                department=department_name if user_type == "student" else None,
                linked_student_id=linked_student_id
            )
            
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            
            # If this was a student, store their ID for guardian linking
            if user_type == "student":
                processed_students[filename_key] = db_user.id
                
            print(f"[+] Saved user '{db_user.name}' to DB.")
            success_count += 1
            
        except Exception as e:
            print(f"[!] Error processing file {filename}: {e}")
            db.rollback()
            error_count += 1
            
    print("\n" + "="*40)
    print(f"[*] Bulk Upload Finished.")
    print(f"[+] Successfully processed: {success_count}")
    print(f"[!] Errors encountered: {error_count}")
    print("="*40)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk upload photos to Cloudinary and register users in Database.")
    parser.add_argument("--folder", type=str, required=True, help="Path to local folder containing photos")
    parser.add_argument("--dept", type=str, default="Computer Science", help="Department name for the students")
    
    args = parser.parse_args()
    run_bulk_upload(args.folder, args.dept)
