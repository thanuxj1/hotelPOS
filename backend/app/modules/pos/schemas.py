from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal


# ─── Menu Category ────────────────────────────────────────────────────────────

class MenuCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

class MenuCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class MenuCategorySchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool
    tenant_id: str
    class Config:
        from_attributes = True


# ─── Menu Item ────────────────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    category_id: int
    is_available: bool = True
    image_url: Optional[str] = None
    preparation_time: int = 15

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    category_id: Optional[int] = None
    is_available: Optional[bool] = None
    image_url: Optional[str] = None
    preparation_time: Optional[int] = None

class MenuItemSchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    category_id: int
    category: Optional[MenuCategorySchema] = None
    is_available: bool
    image_url: Optional[str] = None
    preparation_time: int
    tenant_id: str
    class Config:
        from_attributes = True


# ─── Order Item ───────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = 1
    notes: Optional[str] = None

class OrderItemSchema(BaseModel):
    id: int
    menu_item_id: int
    menu_item: Optional[MenuItemSchema] = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    notes: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Order ────────────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    reservation_id: Optional[int] = None
    room_id: Optional[int] = None
    order_type: str = "restaurant"
    notes: Optional[str] = None
    table_number: Optional[str] = None
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    table_number: Optional[str] = None

class OrderSchema(BaseModel):
    id: int
    order_number: str
    reservation_id: Optional[int] = None
    room_id: Optional[int] = None
    order_type: str
    status: str
    total_amount: Decimal
    notes: Optional[str] = None
    table_number: Optional[str] = None
    items: List[OrderItemSchema]
    tenant_id: str
    class Config:
        from_attributes = True
