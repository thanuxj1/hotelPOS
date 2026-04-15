import random
import string
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.tenant import get_tenant_id
from app.modules.pos.models import MenuCategory, MenuItem, Order, OrderItem, OrderStatus
from app.modules.pos.schemas import (
    MenuCategoryCreate, MenuCategoryUpdate,
    MenuItemCreate, MenuItemUpdate,
    OrderCreate, OrderUpdate,
)


def _gen_order_number() -> str:
    suffix = "".join(random.choices(string.digits, k=6))
    return f"ORD-{suffix}"


class POSService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tid(self) -> str:
        return get_tenant_id() or "public"

    # ─── Menu Categories ─────────────────────────────────────────────────────

    async def create_category(self, cat_in: MenuCategoryCreate) -> MenuCategory:
        cat = MenuCategory(**cat_in.model_dump(), tenant_id=self._tid())
        self.db.add(cat)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def get_categories(self) -> List[MenuCategory]:
        result = await self.db.execute(
            select(MenuCategory)
            .where(MenuCategory.tenant_id == self._tid())
            .order_by(MenuCategory.sort_order, MenuCategory.name)
        )
        return result.scalars().all()

    async def update_category(self, cat_id: int, cat_in: MenuCategoryUpdate) -> Optional[MenuCategory]:
        result = await self.db.execute(
            select(MenuCategory).where(MenuCategory.id == cat_id, MenuCategory.tenant_id == self._tid())
        )
        cat = result.scalars().first()
        if not cat:
            return None
        for k, v in cat_in.model_dump(exclude_unset=True).items():
            setattr(cat, k, v)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def delete_category(self, cat_id: int) -> bool:
        result = await self.db.execute(
            select(MenuCategory).where(MenuCategory.id == cat_id, MenuCategory.tenant_id == self._tid())
        )
        cat = result.scalars().first()
        if not cat:
            return False
        await self.db.delete(cat)
        await self.db.commit()
        return True

    # ─── Menu Items ──────────────────────────────────────────────────────────

    async def create_item(self, item_in: MenuItemCreate) -> MenuItem:
        item = MenuItem(**item_in.model_dump(), tenant_id=self._tid())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def get_items(self, category_id: Optional[int] = None, available_only: bool = False) -> List[MenuItem]:
        q = select(MenuItem).where(MenuItem.tenant_id == self._tid())
        if category_id:
            q = q.where(MenuItem.category_id == category_id)
        if available_only:
            q = q.where(MenuItem.is_available.is_(True))
        result = await self.db.execute(q.order_by(MenuItem.name))
        return result.scalars().all()

    async def get_item(self, item_id: int) -> Optional[MenuItem]:
        result = await self.db.execute(
            select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def update_item(self, item_id: int, item_in: MenuItemUpdate) -> Optional[MenuItem]:
        item = await self.get_item(item_id)
        if not item:
            return None
        for k, v in item_in.model_dump(exclude_unset=True).items():
            setattr(item, k, v)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete_item(self, item_id: int) -> bool:
        item = await self.get_item(item_id)
        if not item:
            return False
        await self.db.delete(item)
        await self.db.commit()
        return True

    # ─── Orders ──────────────────────────────────────────────────────────────

    async def create_order(self, order_in: OrderCreate) -> Order:
        if not order_in.items:
            raise ValueError("Order must have at least one item")

        order = Order(
            order_number=_gen_order_number(),
            reservation_id=order_in.reservation_id,
            room_id=order_in.room_id,
            order_type=order_in.order_type,
            notes=order_in.notes,
            table_number=order_in.table_number,
            status=OrderStatus.PENDING,
            total_amount=0,
            tenant_id=self._tid(),
        )
        self.db.add(order)
        await self.db.flush()  # get order.id

        total = 0.0
        for item_req in order_in.items:
            menu_item = await self.get_item(item_req.menu_item_id)
            if not menu_item:
                raise ValueError(f"Menu item {item_req.menu_item_id} not found")
            if not menu_item.is_available:
                raise ValueError(f"'{menu_item.name}' is currently not available")

            unit_price = float(menu_item.price)
            subtotal = unit_price * item_req.quantity
            total += subtotal

            oi = OrderItem(
                order_id=order.id,
                menu_item_id=item_req.menu_item_id,
                quantity=item_req.quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                notes=item_req.notes,
                tenant_id=self._tid(),
            )
            self.db.add(oi)

        order.total_amount = total
        await self.db.commit()
        
        # Auto-sync with existing invoice if reservation is billed
        if order.reservation_id:
            from app.modules.billing.models import Invoice, InvoiceStatus
            inv_res = await self.db.execute(
                select(Invoice).where(
                    Invoice.reservation_id == order.reservation_id,
                    Invoice.tenant_id == self._tid(),
                    Invoice.status.in_([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID])
                )
            )
            inv = inv_res.scalars().first()
            if inv:
                inv.food_charges = float(inv.food_charges) + float(order.total_amount)
                
                subtotal = float(inv.room_charges) + float(inv.food_charges) + float(inv.other_charges) - float(inv.discount_amount)
                tax = round(subtotal * float(inv.tax_rate) / 100.0, 2)
                tot = round(subtotal + tax, 2)
                
                inv.tax_amount = tax
                inv.total_amount = tot
                inv.balance_due = tot - float(inv.paid_amount)
                
                await self.db.commit()
        
        result = await self.db.execute(
            select(Order).where(Order.id == order.id)
        )
        return result.scalars().first()

    async def get_orders(self, status: Optional[str] = None) -> List[Order]:
        q = select(Order).where(Order.tenant_id == self._tid())
        if status:
            q = q.where(Order.status == status)
        result = await self.db.execute(q.order_by(Order.created_at.desc()))
        return result.scalars().all()

    async def get_order(self, order_id: int) -> Optional[Order]:
        result = await self.db.execute(
            select(Order).where(Order.id == order_id, Order.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def update_order_status(self, order_id: int, new_status: str) -> Order:
        order = await self.get_order(order_id)
        if not order:
            raise ValueError("Order not found")
        valid_statuses = [s.value for s in OrderStatus]
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status '{new_status}'. Must be one of {valid_statuses}")
        order.status = new_status
        await self.db.commit()
        await self.db.refresh(order)
        return order

    async def get_orders_by_reservation(self, reservation_id: int) -> List[Order]:
        result = await self.db.execute(
            select(Order).where(
                Order.reservation_id == reservation_id,
                Order.tenant_id == self._tid(),
            )
        )
        return result.scalars().all()
