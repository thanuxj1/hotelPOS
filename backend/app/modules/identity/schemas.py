from typing import Optional, List
from pydantic import BaseModel, EmailStr

class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None

class PermissionSchema(PermissionBase):
    id: int
    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    permission_ids: List[int] = []

class RoleSchema(RoleBase):
    id: int
    permissions: List[PermissionSchema]
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str
    role_id: int
    tenant_id: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[int] = None

class UserSchema(UserBase):
    id: int
    role: RoleSchema
    tenant_id: str
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None
