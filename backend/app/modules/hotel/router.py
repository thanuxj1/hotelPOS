from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.core.rbac import get_current_user, require_permission, require_any_role
from app.modules.hotel.service import HotelService
from app.modules.hotel.schemas import (
    RoomTypeCreate, RoomTypeUpdate, RoomTypeSchema,
    RoomCreate, RoomUpdate, RoomSchema,
    GuestCreate, GuestUpdate, GuestSchema,
    ReservationCreate, ReservationUpdate, ReservationSchema,
    AvailabilityCheck, HotelStatsSchema,
)
from app.modules.identity.models import User

router = APIRouter()


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", summary="Hotel dashboard stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    svc = HotelService(db)
    return await svc.get_stats()


# ─── Room Types ───────────────────────────────────────────────────────────────

@router.get("/room-types", response_model=List[RoomTypeSchema])
async def list_room_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await HotelService(db).get_room_types()

@router.post("/room-types", response_model=RoomTypeSchema, status_code=201)
async def create_room_type(
    rt_in: RoomTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:write")),
):
    return await HotelService(db).create_room_type(rt_in)

@router.patch("/room-types/{rt_id}", response_model=RoomTypeSchema)
async def update_room_type(
    rt_id: int, rt_in: RoomTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:write")),
):
    rt = await HotelService(db).update_room_type(rt_id, rt_in)
    if not rt:
        raise HTTPException(404, "Room type not found")
    return rt

@router.delete("/room-types/{rt_id}", status_code=204)
async def delete_room_type(
    rt_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:delete")),
):
    ok = await HotelService(db).delete_room_type(rt_id)
    if not ok:
        raise HTTPException(404, "Room type not found")


# ─── Rooms ────────────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=List[RoomSchema])
async def list_rooms(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:read")),
):
    return await HotelService(db).get_rooms(status)

@router.post("/rooms", response_model=RoomSchema, status_code=201)
async def create_room(
    room_in: RoomCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:write")),
):
    return await HotelService(db).create_room(room_in)

@router.get("/rooms/availability", response_model=List[RoomSchema])
async def check_availability(
    check_in_date: str = Query(...),
    check_out_date: str = Query(...),
    room_type_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:read")),
):
    from datetime import date
    ci = date.fromisoformat(check_in_date)
    co = date.fromisoformat(check_out_date)
    return await HotelService(db).get_available_rooms(ci, co, room_type_id)

@router.get("/rooms/{room_id}", response_model=RoomSchema)
async def get_room(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:read")),
):
    room = await HotelService(db).get_room(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    return room

@router.patch("/rooms/{room_id}", response_model=RoomSchema)
async def update_room(
    room_id: int, room_in: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:write")),
):
    room = await HotelService(db).update_room(room_id, room_in)
    if not room:
        raise HTTPException(404, "Room not found")
    return room

@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("rooms:delete")),
):
    ok = await HotelService(db).delete_room(room_id)
    if not ok:
        raise HTTPException(404, "Room not found")


# ─── Guests ───────────────────────────────────────────────────────────────────

@router.get("/guests", response_model=List[GuestSchema])
async def list_guests(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("guests:read")),
):
    return await HotelService(db).get_guests(search)

@router.post("/guests", response_model=GuestSchema, status_code=201)
async def create_guest(
    guest_in: GuestCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("guests:write")),
):
    return await HotelService(db).create_guest(guest_in)

@router.get("/guests/{guest_id}", response_model=GuestSchema)
async def get_guest(
    guest_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("guests:read")),
):
    guest = await HotelService(db).get_guest(guest_id)
    if not guest:
        raise HTTPException(404, "Guest not found")
    return guest

@router.patch("/guests/{guest_id}", response_model=GuestSchema)
async def update_guest(
    guest_id: int, guest_in: GuestUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("guests:write")),
):
    guest = await HotelService(db).update_guest(guest_id, guest_in)
    if not guest:
        raise HTTPException(404, "Guest not found")
    return guest


# ─── Reservations ─────────────────────────────────────────────────────────────

@router.get("/reservations", response_model=List[ReservationSchema])
async def list_reservations(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:read")),
):
    return await HotelService(db).get_reservations(status)

@router.post("/reservations", response_model=ReservationSchema, status_code=201)
async def create_reservation(
    res_in: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:write")),
):
    try:
        return await HotelService(db).create_reservation(res_in)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.get("/reservations/{res_id}", response_model=ReservationSchema)
async def get_reservation(
    res_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:read")),
):
    res = await HotelService(db).get_reservation(res_id)
    if not res:
        raise HTTPException(404, "Reservation not found")
    return res

@router.post("/reservations/{res_id}/check-in", response_model=ReservationSchema)
async def check_in(
    res_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:write")),
):
    try:
        return await HotelService(db).check_in(res_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.post("/reservations/{res_id}/check-out", response_model=ReservationSchema)
async def check_out(
    res_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:write")),
):
    try:
        return await HotelService(db).check_out(res_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.post("/reservations/{res_id}/cancel", response_model=ReservationSchema)
async def cancel_reservation(
    res_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("reservations:write")),
):
    try:
        return await HotelService(db).cancel_reservation(res_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
