import enum
from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Boolean, Text
from sqlalchemy.orm import relationship
from app.models.base import AppBaseModel


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderType(str, enum.Enum):
    ROOM_SERVICE = "room_service"
    RESTAURANT = "restaurant"
    TAKEAWAY = "takeaway"


class MenuCategory(AppBaseModel):
    __tablename__ = "menu_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    items = relationship("MenuItem", back_populates="category", lazy="selectin")


class MenuItem(AppBaseModel):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    category_id = Column(Integer, ForeignKey("menu_categories.id"))
    category = relationship("MenuCategory", back_populates="items", lazy="selectin")
    is_available = Column(Boolean, default=True)
    image_url = Column(String(500))
    preparation_time = Column(Integer, default=15)  # minutes


class Order(AppBaseModel):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(20), unique=True, index=True, nullable=False)

    # Optional links — room service vs. walk-in
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    reservation = relationship("Reservation", back_populates="orders", lazy="selectin")

    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)

    order_type = Column(String(30), default=OrderType.RESTAURANT)
    status = Column(String(20), default=OrderStatus.PENDING, index=True)
    total_amount = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    table_number = Column(String(20))   # for restaurant orders

    items = relationship("OrderItem", back_populates="order", lazy="selectin")


class OrderItem(AppBaseModel):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)  # captured at time of order
    subtotal = Column(Numeric(10, 2), nullable=False)
    notes = Column(Text)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", lazy="selectin")
