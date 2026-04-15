from fastapi import APIRouter

from app.modules.identity.router import router as auth_router
from app.modules.hotel.router import router as hotel_router
from app.modules.pos.router import router as pos_router
from app.modules.billing.router import router as billing_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(hotel_router, prefix="/hotel", tags=["Hotel & Reservations"])
api_router.include_router(pos_router, prefix="/pos", tags=["POS"])
api_router.include_router(billing_router, prefix="/billing", tags=["Billing"])
