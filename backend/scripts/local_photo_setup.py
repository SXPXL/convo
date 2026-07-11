import os
import sys
import shutil
import argparse
from dotenv import load_dotenv

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Load environment configuration
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import SessionLocal
from app.models.user import User

def setup_local_photos(source_folder: str):
    print(f"[*] Starting local photo setup from: {source_folder}")
    
    if not os.path.exists(source_folder):
        print(f"[!] Error: Source folder '{source_folder}' does not exist.")
        return
        
    # Ensure local static photos directory exists inside the project
    target_dir = os.path.join(backend_dir, "static", "photos")
    os.makedirs(target_dir, exist_ok=True)
    print(f"[*] Target local folder: {target_dir}")
    
    db = SessionLocal()
    success_count = 0
    skipped_count = 0
    error_count = 0
    
    try:
        # Get all image files from the source folder
        image_extensions = ('.jpg', '.jpeg', '.png', '.webp')
        all_files = [f for f in os.listdir(source_folder) if f.lower().endswith(image_extensions)]
        print(f"[*] Found {len(all_files)} images in the source folder.")
        
        for filename in all_files:
            file_path = os.path.join(source_folder, filename)
            base_name, ext = os.path.splitext(filename)
            base_name_upper = base_name.upper()
            
            # Map filename suffix to target register_number in database
            # Case 1: ends in -1 or -G1
            if base_name_upper.endswith("-1") or base_name_upper.endswith("-G1"):
                # e.g., THAYCS034-1 -> THAYCS034-G1
                clean_base = base_name_upper.split("-")[0]
                target_reg = f"{clean_base}-G1"
            # Case 2: ends in -2 or -G2
            elif base_name_upper.endswith("-2") or base_name_upper.endswith("-G2"):
                # e.g., THAYCS034-2 -> THAYCS034-G2
                clean_base = base_name_upper.split("-")[0]
                target_reg = f"{clean_base}-G2"
            # Case 3: standard student (no suffix)
            else:
                target_reg = base_name_upper
                
            # Query user in the database
            user = db.query(User).filter(User.register_number == target_reg).first()
            
            if not user:
                print(f"[-] Skipped: No database user found matching register number '{target_reg}' for file '{filename}'.")
                skipped_count += 1
                continue
                
            # Copy file locally to static/photos
            new_filename = f"{target_reg}{ext.lower()}"
            dest_path = os.path.join(target_dir, new_filename)
            
            try:
                shutil.copy2(file_path, dest_path)
                
                # Update photo_url to use relative path served by FastAPI
                local_url = f"/static/photos/{new_filename}"
                user.photo_url = local_url
                
                print(f"  [+] Mapped '{filename}' to {user.type.upper()} '{user.name}' ({target_reg}) -> URL: {local_url}")
                success_count += 1
            except Exception as copy_err:
                print(f"  [!] Failed to copy file {filename}: {copy_err}")
                error_count += 1
                
        db.commit()
        print("\n" + "="*40)
        print("[*] Local photo configuration completed.")
        print(f"[+] Successfully mapped and copied: {success_count}")
        print(f"[-] Skipped (no DB user match): {skipped_count}")
        print(f"[!] File copy errors: {error_count}")
        print("="*40)
        
    except Exception as e:
        db.rollback()
        print(f"[!] General error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Map photos locally instead of uploading them to Cloudinary.")
    parser.add_argument("--folder", type=str, required=True, help="Path to local folder containing attendee photos")
    
    args = parser.parse_args()
    setup_local_photos(args.folder)
