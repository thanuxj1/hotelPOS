from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.middleware import TenantMiddleware
from app.api.v1.api import api_router
from app.websockets.manager import websocket_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Cloud-Native Hotel Management & POS System",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)

# --- Routers ---
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(websocket_router, prefix="/ws")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "version": "1.0.0"}
