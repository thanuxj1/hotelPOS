from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from app.core.config import settings
from app.core.tenant import set_tenant_id, reset_tenant_id
import logging

logger = logging.getLogger(__name__)

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Try to get tenant from Header or JWT
        tenant_id = request.headers.get("X-Tenant-ID")
        
        # If no header, try to extract from Authorization header if present
        auth_header = request.headers.get("Authorization")
        if not tenant_id and auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(
                    token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
                )
                tenant_id = payload.get("tenant_id")
            except JWTError:
                pass
        
        # 2. Set default tenant if still none
        if not tenant_id:
            tenant_id = settings.DEFAULT_TENANT_ID
            
        # 3. Set context
        token = set_tenant_id(tenant_id)
        
        try:
            response = await call_next(request)
            return response
        finally:
            reset_tenant_id(token)


# Since I used ContextVar in tenant.py, I should adjust it to handle the token
