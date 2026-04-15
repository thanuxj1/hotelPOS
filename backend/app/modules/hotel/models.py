import enum
from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Date, DateTime, Text
from sqlalchemy.orm import relationship
from app.models.base import AppBaseModel


class RoomStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"


class ReservationStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class RoomType(AppBaseModel):
    __tablename__ = "room_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    base_price = Column(Numeric(10, 2), nullable=False)
    capacity = Column(Integer, default=2)
    amenities = Column(Text)  # Comma-separated or JSON string
    rooms = relationship("Room", back_populates="room_type", lazy="selectin")


class Room(AppBaseModel):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(20), nullable=False)
    floor = Column(Integer)
    room_type_id = Column(Integer, ForeignKey("room_types.id"))
    room_type = relationship("RoomType", back_populates="rooms", lazy="selectin")
    status = Column(String(20), default=RoomStatus.AVAILABLE, index=True)
    notes = Column(Text)
    reservations = relationship("Reservation", back_populates="room")


class Guest(AppBaseModel):
    __tablename__ = "guests"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False, index=True)
    email = Column(String(200))
    phone = Column(String(30))
    id_type = Column(String(50))   # passport, national_id, driving_license
    id_number = Column(String(100))
    address = Column(Text)
    nationality = Column(String(100))
    reservations = relationship("Reservation", back_populates="guest")


class Reservation(AppBaseModel):
    __tablename__ = "reservations"
    id = Column(Integer, primary_key=True, index=True)
    reservation_number = Column(String(20), unique=True, index=True, nullable=False)

    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    guest = relationship("Guest", back_populates="reservations", lazy="selectin")

    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    room = relationship("Room", back_populates="reservations", lazy="selectin")

    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    actual_check_in = Column(DateTime(timezone=True))
    actual_check_out = Column(DateTime(timezone=True))

    status = Column(String(20), default=ReservationStatus.CONFIRMED, index=True)
    adults = Column(Integer, default=1)
    children = Column(Integer, default=0)
    special_requests = Column(Text)

    room_rate = Column(Numeric(10, 2))        # rate per night at time of booking
    total_nights = Column(Integer)
    total_room_charges = Column(Numeric(10, 2))

    invoices = relationship("Invoice", back_populates="reservation")
    orders = relationship("Order", back_populates="reservation")
