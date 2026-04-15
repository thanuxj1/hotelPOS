import enum
from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from app.models.base import AppBaseModel


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    COMPLIMENTARY = "complimentary"


class Invoice(AppBaseModel):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(30), unique=True, index=True, nullable=False)

    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False)
    reservation = relationship("Reservation", back_populates="invoices", lazy="selectin")

    status = Column(String(20), default=InvoiceStatus.DRAFT, index=True)

    # Charge breakdown
    room_charges = Column(Numeric(10, 2), default=0)
    food_charges = Column(Numeric(10, 2), default=0)
    other_charges = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    tax_rate = Column(Numeric(5, 2), default=12.0)   # percentage
    tax_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), default=0)
    paid_amount = Column(Numeric(10, 2), default=0)
    balance_due = Column(Numeric(10, 2), default=0)

    notes = Column(Text)
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")


class Payment(AppBaseModel):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(String(30), nullable=False)
    reference = Column(String(200))   # transaction ID, cheque no, etc.
    notes = Column(Text)
    invoice = relationship("Invoice", back_populates="payments")
