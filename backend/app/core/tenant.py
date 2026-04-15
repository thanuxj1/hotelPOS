from contextvars import ContextVar, Token
from typing import Optional

# Context variable to store the tenant ID for the current request context
_tenant_id_ctx: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)

def set_tenant_id(tenant_id: str) -> Token:
    return _tenant_id_ctx.set(tenant_id)

def get_tenant_id() -> Optional[str]:
    return _tenant_id_ctx.get()

def reset_tenant_id(token: Token) -> None:
    _tenant_id_ctx.reset(token)
