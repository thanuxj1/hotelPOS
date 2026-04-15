import random
import string
from datetime import date, datetime, timezone
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

from app.core.tenant import get_tenant_id
from app.modules.hotel.models import Room, RoomType, Guest, Reservation, RoomStatus, ReservationStatus
from app.modules.hotel.schemas import (
    RoomCreate, RoomUpdate,
    RoomTypeCreate, RoomTypeUpdate,
    GuestCreate, GuestUpdate,
    ReservationCreate, ReservationUpdate,
)


def _gen_reservation_number() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"RES-{suffix}"


class HotelService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tid(self) -> str:
        return get_tenant_id() or "public"

    # ─── Room Types ──────────────────────────────────────────────────────────

    async def create_room_type(self, rt_in: RoomTypeCreate) -> RoomType:
        rt = RoomType(**rt_in.model_dump(), tenant_id=self._tid())
        self.db.add(rt)
        await self.db.commit()
        await self.db.refresh(rt)
        return rt

    async def get_room_types(self) -> List[RoomType]:
        result = await self.db.execute(
            select(RoomType).where(RoomType.tenant_id == self._tid())
        )
        return result.scalars().all()

    async def get_room_type(self, rt_id: int) -> Optional[RoomType]:
        result = await self.db.execute(
            select(RoomType).where(RoomType.id == rt_id, RoomType.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def update_room_type(self, rt_id: int, rt_in: RoomTypeUpdate) -> Optional[RoomType]:
        rt = await self.get_room_type(rt_id)
        if not rt:
            return None
        for k, v in rt_in.model_dump(exclude_unset=True).items():
            setattr(rt, k, v)
        await self.db.commit()
        await self.db.refresh(rt)
        return rt

    async def delete_room_type(self, rt_id: int) -> bool:
        rt = await self.get_room_type(rt_id)
        if not rt:
            return False
        await self.db.delete(rt)
        await self.db.commit()
        return True

    # ─── Rooms ───────────────────────────────────────────────────────────────

    async def create_room(self, room_in: RoomCreate) -> Room:
        room = Room(**room_in.model_dump(), tenant_id=self._tid())
        self.db.add(room)
        await self.db.commit()
        await self.db.refresh(room)
        return room

    async def get_rooms(self, status: Optional[str] = None) -> List[Room]:
        q = select(Room).where(Room.tenant_id == self._tid())
        if status:
            q = q.where(Room.status == status)
        result = await self.db.execute(q.order_by(Room.room_number))
        return result.scalars().all()

    async def get_room(self, room_id: int) -> Optional[Room]:
        result = await self.db.execute(
            select(Room).where(Room.id == room_id, Room.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def update_room(self, room_id: int, room_in: RoomUpdate) -> Optional[Room]:
        room = await self.get_room(room_id)
        if not room:
            return None
        for k, v in room_in.model_dump(exclude_unset=True).items():
            setattr(room, k, v)
        await self.db.commit()
        await self.db.refresh(room)
        return room

    async def delete_room(self, room_id: int) -> bool:
        room = await self.get_room(room_id)
        if not room:
            return False
        await self.db.delete(room)
        await self.db.commit()
        return True

    async def get_available_rooms(
        self, check_in: date, check_out: date, room_type_id: Optional[int] = None
    ) -> List[Room]:
        overlap_q = select(Reservation.room_id).where(
            Reservation.tenant_id == self._tid(),
            Reservation.status.in_(["confirmed", "checked_in"]),
            Reservation.check_in_date < check_out,
            Reservation.check_out_date > check_in,
        )
        overlap_res = await self.db.execute(overlap_q)
        occupied_ids = [r[0] for r in overlap_res.fetchall()]

        q = select(Room).where(
            Room.tenant_id == self._tid(),
            Room.status == RoomStatus.AVAILABLE,
            Room.id.not_in(occupied_ids) if occupied_ids else True,
        )
        if room_type_id:
            q = q.where(Room.room_type_id == room_type_id)
        result = await self.db.execute(q)
        return result.scalars().all()

    # ─── Guests ──────────────────────────────────────────────────────────────

    async def create_guest(self, guest_in: GuestCreate) -> Guest:
        guest = Guest(**guest_in.model_dump(), tenant_id=self._tid())
        self.db.add(guest)
        await self.db.commit()
        await self.db.refresh(guest)
        return guest

    async def get_guests(self, search: Optional[str] = None) -> List[Guest]:
        q = select(Guest).where(Guest.tenant_id == self._tid())
        if search:
            q = q.where(
                or_(
                    Guest.full_name.ilike(f"%{search}%"),
                    Guest.email.ilike(f"%{search}%"),
                    Guest.phone.ilike(f"%{search}%"),
                )
            )
        result = await self.db.execute(q.order_by(Guest.full_name))
        return result.scalars().all()

    async def get_guest(self, guest_id: int) -> Optional[Guest]:
        result = await self.db.execute(
            select(Guest).where(Guest.id == guest_id, Guest.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def update_guest(self, guest_id: int, guest_in: GuestUpdate) -> Optional[Guest]:
        guest = await self.get_guest(guest_id)
        if not guest:
            return None
        for k, v in guest_in.model_dump(exclude_unset=True).items():
            setattr(guest, k, v)
        await self.db.commit()
        await self.db.refresh(guest)
        return guest

    # ─── Reservations ────────────────────────────────────────────────────────

    async def create_reservation(self, res_in: ReservationCreate) -> Reservation:
        room = await self.get_room(res_in.room_id)
        if not room:
            raise ValueError("Room not found")
        if room.status not in [RoomStatus.AVAILABLE]:
            raise ValueError(f"Room is not available (status: {room.status})")

        total_nights = (res_in.check_out_date - res_in.check_in_date).days
        if total_nights <= 0:
            raise ValueError("Check-out date must be after check-in date")

        rate = float(room.room_type.base_price) if room.room_type else 0.0
        total_room_charges = rate * total_nights

        reservation = Reservation(
            **res_in.model_dump(),
            tenant_id=self._tid(),
            reservation_number=_gen_reservation_number(),
            room_rate=rate,
            total_nights=total_nights,
            total_room_charges=total_room_charges,
            status=ReservationStatus.CONFIRMED,
        )
        room.status = RoomStatus.RESERVED
        self.db.add(reservation)
        await self.db.commit()
        await self.db.refresh(reservation)
        return reservation

    async def get_reservations(self, status: Optional[str] = None) -> List[Reservation]:
        q = select(Reservation).where(Reservation.tenant_id == self._tid())
        if status:
            q = q.where(Reservation.status == status)
        result = await self.db.execute(q.order_by(Reservation.check_in_date.desc()))
        return result.scalars().all()

    async def get_reservation(self, res_id: int) -> Optional[Reservation]:
        result = await self.db.execute(
            select(Reservation).where(
                Reservation.id == res_id, Reservation.tenant_id == self._tid()
            )
        )
        return result.scalars().first()

    async def check_in(self, res_id: int) -> Reservation:
        res = await self.get_reservation(res_id)
        if not res:
            raise ValueError("Reservation not found")
        if res.status != ReservationStatus.CONFIRMED:
            raise ValueError(f"Cannot check in — status is '{res.status}'")
        res.status = ReservationStatus.CHECKED_IN
        res.actual_check_in = datetime.now(timezone.utc)
        room = await self.get_room(res.room_id)
        if room:
            room.status = RoomStatus.OCCUPIED
        await self.db.commit()
        await self.db.refresh(res)
        return res

    async def check_out(self, res_id: int) -> Reservation:
        res = await self.get_reservation(res_id)
        if not res:
            raise ValueError("Reservation not found")
        if res.status != ReservationStatus.CHECKED_IN:
            raise ValueError(f"Cannot check out — status is '{res.status}'")
        res.status = ReservationStatus.CHECKED_OUT
        res.actual_check_out = datetime.now(timezone.utc)
        room = await self.get_room(res.room_id)
        if room:
            room.status = RoomStatus.CLEANING
        await self.db.commit()
        await self.db.refresh(res)
        return res

    async def cancel_reservation(self, res_id: int) -> Reservation:
        res = await self.get_reservation(res_id)
        if not res:
            raise ValueError("Reservation not found")
        if res.status in [ReservationStatus.CHECKED_OUT, ReservationStatus.CANCELLED]:
            raise ValueError(f"Cannot cancel — status is '{res.status}'")
        res.status = ReservationStatus.CANCELLED
        room = await self.get_room(res.room_id)
        if room and room.status == RoomStatus.RESERVED:
            room.status = RoomStatus.AVAILABLE
        await self.db.commit()
        await self.db.refresh(res)
        return res

    # ─── Stats ───────────────────────────────────────────────────────────────

    async def get_stats(self) -> dict:
        tid = self._tid()
        rooms_res = await self.db.execute(
            select(Room.status, func.count(Room.id))
            .where(Room.tenant_id == tid)
            .group_by(Room.status)
        )
        room_stats = {row[0]: row[1] for row in rooms_res.fetchall()}
        today = date.today()
        ci = await self.db.execute(
            select(func.count(Reservation.id)).where(
                Reservation.tenant_id == tid,
                Reservation.check_in_date == today,
                Reservation.status != "cancelled",
            )
        )
        co = await self.db.execute(
            select(func.count(Reservation.id)).where(
                Reservation.tenant_id == tid,
                Reservation.check_out_date == today,
                Reservation.status.in_(["confirmed", "checked_in"]),
            )
        )
        return {
            "room_stats": room_stats,
            "check_ins_today": ci.scalar() or 0,
            "check_outs_today": co.scalar() or 0,
            "total_rooms": sum(room_stats.values()),
            "occupied": room_stats.get("occupied", 0),
            "available": room_stats.get("available", 0),
        }
