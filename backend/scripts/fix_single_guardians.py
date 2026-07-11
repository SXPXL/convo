import os
import sys
from dotenv import load_dotenv

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Load environment configuration
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import SessionLocal
from app.models.user import User

def fix_orphaned_g2_guardians():
    db = SessionLocal()
    try:
        # Find all guardians ending in -G2
        g2_guardians = db.query(User).filter(
            (User.type == "guardian") & (User.register_number.like("%-G2"))
        ).all()
        
        fixed_count = 0
        print(f"[*] Found {len(g2_guardians)} G2 guardians in the database.")
        
        for g2 in g2_guardians:
            reg_base = g2.register_number[:-3] # remove '-G2'
            g1_reg = f"{reg_base}-G1"
            
            # Check if a G1 guardian already exists for this student
            g1_exists = db.query(User).filter(User.register_number == g1_reg).first()
            
            if not g1_exists:
                # No G1 exists, so this is a single guardian. Rename G2 to G1!
                old_reg = g2.register_number
                g2.register_number = g1_reg
                
                # Also fix admission number if present
                if g2.admission_number and g2.admission_number.endswith("-G2"):
                    g2.admission_number = g2.admission_number[:-3] + "-G1"
                    
                print(f"  [+] Updated single guardian: {old_reg} -> {g1_reg} (Name: {g2.name})")
                fixed_count += 1
                
        if fixed_count > 0:
            db.commit()
            print(f"[*] Successfully converted {fixed_count} single guardians to G1 slots.")
        else:
            print("[*] No single G2 guardians require updating.")
            
    except Exception as e:
        db.rollback()
        print(f"[!] Error running migration script: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_orphaned_g2_guardians()
