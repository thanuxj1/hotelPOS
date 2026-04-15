import asyncio
from app.core.database import async_session_factory
from app.modules.hotel.models import Reservation, ReservationStatus
from sqlalchemy.future import select
from app.core.tenant import set_tenant_id

async def check():
    set_tenant_id("demo_hotel")
    async with async_session_factory() as db:
        result = await db.execute(select(Reservation).where(Reservation.status == ReservationStatus.CHECKED_IN))
        resvs = result.scalars().all()
        print(f"Found {len(resvs)} checked-in reservations")
        for r in resvs:
            print(f"Res ID: {r.id}, Guest: {r.guest.full_name}, Room: {r.room.room_number}")

if __name__ == "__main__":
    asyncio.run(check())
