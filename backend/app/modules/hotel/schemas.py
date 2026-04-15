from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal


# ─── Room Type ───────────────────────────────────────────────────────────────

class RoomTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    base_price: Decimal
    capacity: int = 2
    amenities: Optional[str] = None

class RoomTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[Decimal] = None
    capacity: Optional[int] = None
    amenities: Optional[str] = None

class RoomTypeSchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    base_price: Decimal
    capacity: int
    amenities: Optional[str] = None
    tenant_id: str
    class Config:
        from_attributes = True


# ─── Room ─────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    room_number: str
    floor: Optional[int] = None
    room_type_id: int
    status: str = "available"
    notes: Optional[str] = None

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[int] = None
    room_type_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class RoomSchema(BaseModel):
    id: int
    room_number: str
    floor: Optional[int] = None
    room_type_id: int
    room_type: Optional[RoomTypeSchema] = None
    status: str
    notes: Optional[str] = None
    tenant_id: str
    class Config:
        from_attributes = True


# ─── Guest ────────────────────────────────────────────────────────────────────

class GuestCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None

class GuestUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None

class GuestSchema(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None
    tenant_id: str
    class Config:
        from_attributes = True


# ─── Reservation ──────────────────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    guest_id: int
    room_id: int
    check_in_date: date
    check_out_date: date
    adults: int = 1
    children: int = 0
    special_requests: Optional[str] = None

class ReservationUpdate(BaseModel):
    check_in_date: Optional[date] = None
    check_out_date: Optional[date] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    special_requests: Optional[str] = None
    status: Optional[str] = None

class ReservationSchema(BaseModel):
    id: int
    reservation_number: str
    guest: GuestSchema
    room: RoomSchema
    check_in_date: date
    check_out_date: date
    actual_check_in: Optional[datetime] = None
    actual_check_out: Optional[datetime] = None
    status: str
    adults: int
    children: int
    special_requests: Optional[str] = None
    room_rate: Optional[Decimal] = None
    total_nights: Optional[int] = None
    total_room_charges: Optional[Decimal] = None
    tenant_id: str
    class Config:
        from_attributes = True

class AvailabilityCheck(BaseModel):
    check_in_date: date
    check_out_date: date
    room_type_id: Optional[int] = None

class HotelStatsSchema(BaseModel):
    room_stats: dict
    check_ins_today: int
    check_outs_today: int
    total_rooms: int
    occupied: int
    available: int
