import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Depends, Query, status
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from sqlalchemy.orm import Session
import jwt

from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.scanner import router as scanner_router
from app.routes.dashboard import router as dashboard_router
from app.routes.admin import router as admin_router
from app.utils.ws_manager import manager
from sqlalchemy import text
from app.database import engine, get_db
from app.models.staff import Staff

# Automatically alter table to include is_aligned column if missing
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_aligned BOOLEAN DEFAULT FALSE"))
        conn.commit()
    print("[*] Checked/Applied database schema migration: is_aligned column added successfully.")
except Exception as e:
    print(f"[*] Database schema migration warning: {e}")

app = FastAPI(
    title="College Program Entry Management System",
    description="Secure check-in system with QR code scanning and real-time dashboard analytics",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

# CORS middleware for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_router)
app.include_router(scanner_router)
app.include_router(dashboard_router)
app.include_router(admin_router)

# Mount static files directory
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

# Ensure static and templates directories exist
os.makedirs(static_dir, exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Health check endpoint
@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "healthy"}

# HTML Page Routes
@app.get("/")
@app.get("/login")
def get_login_page():
    return FileResponse(os.path.join(templates_dir, "login.html"))

@app.get("/scanner")
def get_scanner_page():
    return FileResponse(os.path.join(templates_dir, "scanner.html"))

@app.get("/dashboard")
def get_dashboard_page():
    return FileResponse(os.path.join(templates_dir, "dashboard.html"))

@app.get("/welcome")
def get_welcome_page():
    return FileResponse(os.path.join(templates_dir, "welcome.html"))

@app.get("/settings")
def get_settings_page():
    return FileResponse(os.path.join(templates_dir, "settings.html"))

@app.websocket("/ws/checkins")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    # Retrieve access token from query params or cookie
    token_str = token or websocket.cookies.get("access_token")
    if not token_str:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        # Decode and verify token
        payload = jwt.decode(token_str, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        username = payload.get("sub")
        if not username:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
        # Verify staff exists and has access rights
        staff = db.query(Staff).filter(Staff.username == username).first()
        if not staff or staff.role not in ["admin", "security", "dept_head"]:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection, handle client disconnects
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Generic exception handler for database or unexpected errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the exception details in production
    import logging
    logging.error(f"Global exception caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact the administrator."}
    )
