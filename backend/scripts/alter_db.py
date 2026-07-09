import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Add parent directory to path to import app modules if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    # Load environment variables
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[!] DATABASE_URL not found in environment.")
        sys.exit(1)

    print(f"[*] Connecting to database...")
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("[*] Checking / Adding register_number column...")
            # 1. Add register_number column as nullable first
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS register_number VARCHAR;"))
            
            # 2. Populate register_number with admission_number for existing records
            conn.execute(text("UPDATE users SET register_number = admission_number WHERE register_number IS NULL;"))
            
            # 3. Make register_number NOT NULL
            conn.execute(text("ALTER TABLE users ALTER COLUMN register_number SET NOT NULL;"))
            
            # 4. Add unique constraint to register_number (drop existing constraint first to avoid duplicates if rerun)
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_register_number_key;"))
            conn.execute(text("ALTER TABLE users ADD CONSTRAINT users_register_number_key UNIQUE (register_number);"))
            
            # 5. Drop NOT NULL from admission_number
            conn.execute(text("ALTER TABLE users ALTER COLUMN admission_number DROP NOT NULL;"))
            
            # 6. Drop unique constraint from admission_number if it exists
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_admission_number_key;"))
            conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_admission_number;"))
            
            trans.commit()
            print("[+] Migration completed successfully!")
        except Exception as e:
            trans.rollback()
            print(f"[!] Migration failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
