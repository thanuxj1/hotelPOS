from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.core.rbac import get_current_user, require_permission
from app.modules.pos.service import POSService
from app.modules.pos.schemas import (
    MenuCategoryCreate, MenuCategoryUpdate, MenuCategorySchema,
    MenuItemCreate, MenuItemUpdate, MenuItemSchema,
    OrderCreate, OrderUpdate, OrderSchema,
)
from app.modules.identity.models import User

router = APIRouter()


# ─── Menu Categories ──────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[MenuCategorySchema])
async def list_categories(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await POSService(db).get_categories()

@router.post("/categories", response_model=MenuCategorySchema, status_code=201)
async def create_category(
    cat_in: MenuCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    return await POSService(db).create_category(cat_in)

@router.patch("/categories/{cat_id}", response_model=MenuCategorySchema)
async def update_category(
    cat_id: int, cat_in: MenuCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    cat = await POSService(db).update_category(cat_id, cat_in)
    if not cat:
        raise HTTPException(404, "Category not found")
    return cat

@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    ok = await POSService(db).delete_category(cat_id)
    if not ok:
        raise HTTPException(404, "Category not found")


# ─── Menu Items ───────────────────────────────────────────────────────────────

@router.get("/menu", response_model=List[MenuItemSchema])
async def list_menu_items(
    category_id: Optional[int] = Query(None),
    available_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await POSService(db).get_items(category_id, available_only)

@router.post("/menu", response_model=MenuItemSchema, status_code=201)
async def create_menu_item(
    item_in: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    return await POSService(db).create_item(item_in)

@router.get("/menu/{item_id}", response_model=MenuItemSchema)
async def get_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = await POSService(db).get_item(item_id)
    if not item:
        raise HTTPException(404, "Menu item not found")
    return item

@router.patch("/menu/{item_id}", response_model=MenuItemSchema)
async def update_menu_item(
    item_id: int, item_in: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    item = await POSService(db).update_item(item_id, item_in)
    if not item:
        raise HTTPException(404, "Menu item not found")
    return item

@router.delete("/menu/{item_id}", status_code=204)
async def delete_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    ok = await POSService(db).delete_item(item_id)
    if not ok:
        raise HTTPException(404, "Menu item not found")


# ─── Orders ───────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[OrderSchema])
async def list_orders(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:read")),
):
    return await POSService(db).get_orders(status)

@router.post("/orders", response_model=OrderSchema, status_code=201)
async def create_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    try:
        return await POSService(db).create_order(order_in)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.get("/orders/{order_id}", response_model=OrderSchema)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:read")),
):
    order = await POSService(db).get_order(order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@router.patch("/orders/{order_id}/status", response_model=OrderSchema)
async def update_order_status(
    order_id: int,
    status: str = Query(..., description="New order status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("pos:write")),
):
    try:
        return await POSService(db).update_order_status(order_id, status)
    except ValueError as e:
        raise HTTPException(400, str(e))
