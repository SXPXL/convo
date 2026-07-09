from app.routes.auth import router as auth_router
from app.routes.scanner import router as scanner_router
from app.routes.dashboard import router as dashboard_router
from app.routes.admin import router as admin_router

__all__ = ["auth_router", "scanner_router", "dashboard_router", "admin_router"]
