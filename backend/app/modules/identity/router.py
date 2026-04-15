from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.rbac import get_current_user, require_any_role
from app.core.security import create_access_token, create_refresh_token
from app.modules.identity.service import IdentityService
from app.modules.identity.schemas import (
    Token, UserCreate, UserSchema, UserUpdate,
    RoleSchema, RoleCreate,
)
from app.modules.identity.models import User

router = APIRouter()


# ─── Auth ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token, summary="Tenant-aware login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    service = IdentityService(db)
    user = await service.authenticate(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")

    access_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, role=user.role.name
    )
    refresh_token = create_refresh_token(
        subject=user.id, tenant_id=user.tenant_id
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserSchema, summary="Get current user profile")
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


# ─── Users (Admin only) ──────────────────────────────────────────────────────

@router.post("/users", response_model=UserSchema, summary="Create a new user")
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_any_role(["admin", "super_admin"])),
):
    service = IdentityService(db)
    existing = await service.get_user_by_email(user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return await service.create_user(user_in)


@router.get("/users", response_model=List[UserSchema], summary="List all users (admin)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_any_role(["admin", "super_admin"])),
):
    service = IdentityService(db)
    return await service.get_all_users()


@router.patch("/users/{user_id}", response_model=UserSchema, summary="Update user")
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_any_role(["admin", "super_admin"])),
):
    service = IdentityService(db)
    user = await service.update_user(user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── Roles & Permissions ──────────────────────────────────────────────────────

@router.get("/roles", response_model=List[RoleSchema], summary="List all roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = IdentityService(db)
    return await service.get_roles()


@router.post("/roles", response_model=RoleSchema, summary="Create a role")
async def create_role(
    role_in: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_any_role(["admin", "super_admin"])),
):
    service = IdentityService(db)
    return await service.create_role(role_in.name, role_in.permission_ids)


@router.get("/permissions", summary="List all permissions")
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    service = IdentityService(db)
    return await service.get_permissions()
