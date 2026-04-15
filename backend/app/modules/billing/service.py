import random
import string
from decimal import Decimal
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.tenant import get_tenant_id
from app.modules.billing.models import Invoice, Payment, InvoiceStatus
from app.modules.billing.schemas import InvoiceCreate, InvoiceUpdate, PaymentCreate
from app.modules.hotel.models import Reservation
from app.modules.pos.models import Order


def _gen_invoice_number() -> str:
    suffix = "".join(random.choices(string.digits, k=8))
    return f"INV-{suffix}"


class BillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tid(self) -> str:
        return get_tenant_id() or "public"

    async def _get_reservation(self, res_id: int) -> Optional[Reservation]:
        result = await self.db.execute(
            select(Reservation).where(
                Reservation.id == res_id,
                Reservation.tenant_id == self._tid(),
            )
        )
        return result.scalars().first()

    async def _sum_food_charges(self, reservation_id: int) -> float:
        result = await self.db.execute(
            select(Order).where(
                Order.reservation_id == reservation_id,
                Order.tenant_id == self._tid(),
                Order.status != "cancelled",
            )
        )
        orders = result.scalars().all()
        return sum(float(o.total_amount) for o in orders)

    def _compute_totals(
        self,
        room_charges: float,
        food_charges: float,
        other_charges: float,
        discount: float,
        tax_rate: float,
    ) -> dict:
        subtotal = room_charges + food_charges + other_charges - discount
        tax_amount = round(subtotal * tax_rate / 100, 2)
        total = round(subtotal + tax_amount, 2)
        return {
            "tax_amount": tax_amount,
            "total_amount": total,
        }

    # ─── Invoices ────────────────────────────────────────────────────────────

    async def create_invoice(self, inv_in: InvoiceCreate) -> Invoice:
        # Ensure no duplicate invoice for same reservation
        existing = await self.db.execute(
            select(Invoice).where(
                Invoice.reservation_id == inv_in.reservation_id,
                Invoice.tenant_id == self._tid(),
                Invoice.status != InvoiceStatus.CANCELLED,
            )
        )
        if existing.scalars().first():
            raise ValueError("An active invoice already exists for this reservation")

        reservation = await self._get_reservation(inv_in.reservation_id)
        if not reservation:
            raise ValueError("Reservation not found")

        room_charges = float(reservation.total_room_charges or 0)
        food_charges = await self._sum_food_charges(inv_in.reservation_id)
        other_charges = float(inv_in.other_charges)
        discount = float(inv_in.discount_amount)
        tax_rate = float(inv_in.tax_rate)

        totals = self._compute_totals(room_charges, food_charges, other_charges, discount, tax_rate)

        invoice = Invoice(
            invoice_number=_gen_invoice_number(),
            reservation_id=inv_in.reservation_id,
            notes=inv_in.notes,
            status=InvoiceStatus.ISSUED,
            room_charges=room_charges,
            food_charges=food_charges,
            other_charges=other_charges,
            discount_amount=discount,
            tax_rate=tax_rate,
            tax_amount=totals["tax_amount"],
            total_amount=totals["total_amount"],
            paid_amount=0,
            balance_due=totals["total_amount"],
            tenant_id=self._tid(),
        )
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def get_invoices(self, status: Optional[str] = None) -> List[Invoice]:
        q = select(Invoice).where(Invoice.tenant_id == self._tid())
        if status:
            q = q.where(Invoice.status == status)
        result = await self.db.execute(q.order_by(Invoice.created_at.desc()))
        return result.scalars().all()

    async def get_invoice(self, invoice_id: int) -> Optional[Invoice]:
        result = await self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == self._tid())
        )
        return result.scalars().first()

    async def get_invoice_by_reservation(self, reservation_id: int) -> Optional[Invoice]:
        result = await self.db.execute(
            select(Invoice).where(
                Invoice.reservation_id == reservation_id,
                Invoice.tenant_id == self._tid(),
                Invoice.status != InvoiceStatus.CANCELLED,
            )
        )
        return result.scalars().first()

    async def update_invoice(self, invoice_id: int, inv_in: InvoiceUpdate) -> Optional[Invoice]:
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            return None

        update_data = inv_in.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(invoice, k, v)

        # Recompute totals if financial fields changed
        if any(k in update_data for k in ["other_charges", "discount_amount", "tax_rate"]):
            totals = self._compute_totals(
                float(invoice.room_charges),
                float(invoice.food_charges),
                float(invoice.other_charges),
                float(invoice.discount_amount),
                float(invoice.tax_rate),
            )
            invoice.tax_amount = totals["tax_amount"]
            invoice.total_amount = totals["total_amount"]
            invoice.balance_due = totals["total_amount"] - float(invoice.paid_amount)

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─── Payments ────────────────────────────────────────────────────────────

    async def add_payment(self, invoice_id: int, pay_in: PaymentCreate) -> Invoice:
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        if invoice.status == InvoiceStatus.PAID:
            raise ValueError("Invoice is already fully paid")
        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValueError("Cannot add payment to a cancelled invoice")

        amount = float(pay_in.amount)
        if amount <= 0:
            raise ValueError("Payment amount must be positive")
        if amount > float(invoice.balance_due):
            raise ValueError(f"Payment amount exceeds balance due (₹{invoice.balance_due})")

        payment = Payment(
            invoice_id=invoice_id,
            amount=amount,
            method=pay_in.method,
            reference=pay_in.reference,
            notes=pay_in.notes,
            tenant_id=self._tid(),
        )
        self.db.add(payment)

        invoice.paid_amount = float(invoice.paid_amount) + amount
        invoice.balance_due = float(invoice.total_amount) - float(invoice.paid_amount)

        if float(invoice.balance_due) <= 0:
            invoice.status = InvoiceStatus.PAID
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─── Revenue Stats ───────────────────────────────────────────────────────

    async def get_revenue_stats(self) -> dict:
        from sqlalchemy import func
        tid = self._tid()

        total_res = await self.db.execute(
            select(func.sum(Invoice.total_amount)).where(
                Invoice.tenant_id == tid,
                Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID]),
            )
        )
        collected_res = await self.db.execute(
            select(func.sum(Invoice.paid_amount)).where(Invoice.tenant_id == tid)
        )
        outstanding_res = await self.db.execute(
            select(func.sum(Invoice.balance_due)).where(
                Invoice.tenant_id == tid,
                Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]),
            )
        )
        return {
            "total_billed": float(total_res.scalar() or 0),
            "total_collected": float(collected_res.scalar() or 0),
            "outstanding": float(outstanding_res.scalar() or 0),
        }
