from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.core.rbac import get_current_user, require_permission
from app.modules.billing.service import BillingService
from app.modules.billing.schemas import (
    InvoiceCreate, InvoiceUpdate, InvoiceSchema,
    PaymentCreate, PaymentSchema,
)
from app.modules.identity.models import User

router = APIRouter()


@router.get("/stats", summary="Revenue statistics")
async def revenue_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:read")),
):
    return await BillingService(db).get_revenue_stats()


@router.get("/invoices", response_model=List[InvoiceSchema])
async def list_invoices(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:read")),
):
    return await BillingService(db).get_invoices(status)


@router.post("/invoices", response_model=InvoiceSchema, status_code=201)
async def create_invoice(
    inv_in: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:write")),
):
    try:
        return await BillingService(db).create_invoice(inv_in)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/invoices/reservation/{reservation_id}", response_model=InvoiceSchema)
async def get_invoice_by_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:read")),
):
    inv = await BillingService(db).get_invoice_by_reservation(reservation_id)
    if not inv:
        raise HTTPException(404, "No invoice found for this reservation")
    return inv


@router.get("/invoices/{invoice_id}", response_model=InvoiceSchema)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:read")),
):
    inv = await BillingService(db).get_invoice(invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.patch("/invoices/{invoice_id}", response_model=InvoiceSchema)
async def update_invoice(
    invoice_id: int, inv_in: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:write")),
):
    inv = await BillingService(db).update_invoice(invoice_id, inv_in)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.post("/invoices/{invoice_id}/payments", response_model=InvoiceSchema)
async def add_payment(
    invoice_id: int, pay_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("billing:write")),
):
    try:
        return await BillingService(db).add_payment(invoice_id, pay_in)
    except ValueError as e:
        raise HTTPException(400, str(e))
