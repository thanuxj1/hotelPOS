from datetime import datetime
from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.orm import declared_attr
from sqlalchemy.sql import func
from app.core.database import Base

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TenantMixin:
    @declared_attr
    def tenant_id(cls):
        return Column(String, index=True, nullable=False)

class AppBaseModel(Base, TimestampMixin, TenantMixin):
    __abstract__ = True
