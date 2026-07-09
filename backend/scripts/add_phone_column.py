import sys
import os

# Adjust path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, text
from app.config import settings

def run_migration():
    print(f"Connecting to database: {settings.DATABASE_URL.split('@')[-1]}")
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("[*] Adding phone column to users table...")
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR;"))
        conn.commit()
        print("[+] Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
