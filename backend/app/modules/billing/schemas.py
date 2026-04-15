from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime


# ─── Payment ──────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    amount: Decimal
    method: str  # cash, card, upi, bank_transfer, complimentary
    reference: Optional[str] = None
    notes: Optional[str] = None

class PaymentSchema(BaseModel):
    id: int
    invoice_id: int
    amount: Decimal
    method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# ─── Invoice ──────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    reservation_id: int
    other_charges: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("12.0")  # %
    notes: Optional[str] = None

class InvoiceUpdate(BaseModel):
    other_charges: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class InvoiceSchema(BaseModel):
    id: int
    invoice_number: str
    reservation_id: int
    status: str
    room_charges: Decimal
    food_charges: Decimal
    other_charges: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    notes: Optional[str] = None
    payments: List[PaymentSchema] = []
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True
