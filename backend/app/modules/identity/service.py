from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.modules.identity.models import User, Role, Permission
from app.modules.identity.schemas import UserCreate, UserUpdate
from app.core.tenant import get_tenant_id


class IdentityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalars().first()

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    async def get_all_users(self) -> List[User]:
        tid = get_tenant_id() or "public"
        result = await self.db.execute(select(User).where(User.tenant_id == tid))
        return result.scalars().all()

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        user = await self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def create_user(self, user_in: UserCreate) -> User:
        db_user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role_id=user_in.role_id,
            tenant_id=user_in.tenant_id,
            is_active=user_in.is_active if user_in.is_active is not None else True,
        )
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        return db_user

    async def update_user(self, user_id: int, user_in: UserUpdate) -> Optional[User]:
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        update_data = user_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
        for field, value in update_data.items():
            setattr(user, field, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_role(self, name: str, permission_ids: List[int]) -> Role:
        role = Role(name=name)
        if permission_ids:
            perms_result = await self.db.execute(
                select(Permission).where(Permission.id.in_(permission_ids))
            )
            role.permissions = list(perms_result.scalars().all())
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def get_roles(self) -> List[Role]:
        result = await self.db.execute(select(Role))
        return result.scalars().all()

    async def get_permissions(self) -> List[Permission]:
        result = await self.db.execute(select(Permission))
        return result.scalars().all()

    async def seed_permissions_and_roles(self) -> None:
        """Idempotent seed: create default permissions and roles if they don't exist."""
        existing = await self.get_permissions()
        if existing:
            return  # Already seeded

        permission_names = [
            ("rooms:read", "View rooms and room types"),
            ("rooms:write", "Create and update rooms"),
            ("rooms:delete", "Delete rooms"),
            ("reservations:read", "View reservations"),
            ("reservations:write", "Create and manage reservations"),
            ("guests:read", "View guest profiles"),
            ("guests:write", "Create and update guests"),
            ("pos:read", "View POS orders and menu"),
            ("pos:write", "Create and manage orders"),
            ("billing:read", "View invoices"),
            ("billing:write", "Create invoices and record payments"),
            ("users:manage", "Manage users and roles"),
            ("reports:read", "Access reports and analytics"),
        ]

        perms = []
        for name, desc in permission_names:
            p = Permission(name=name, description=desc)
            self.db.add(p)
            perms.append(p)
        await self.db.flush()

        # Build role -> permission mapping
        all_perm_names = {p.name for p in perms}
        roles_config = {
            "super_admin": list(all_perm_names),
            "admin": list(all_perm_names - {"users:manage"}),
            "receptionist": [
                "rooms:read", "reservations:read", "reservations:write",
                "guests:read", "guests:write", "billing:read", "billing:write", "pos:read", "pos:write",
            ],
            "housekeeping": ["rooms:read", "rooms:write"],
            "kitchen": ["pos:read", "pos:write", "reservations:read", "rooms:read"],
            "cashier": ["billing:read", "billing:write", "pos:read", "pos:write", "reservations:read", "rooms:read"],
        }

        for role_name, perm_names in roles_config.items():
            role_perms = [p for p in perms if p.name in perm_names]
            role = Role(name=role_name, permissions=role_perms)
            self.db.add(role)

        await self.db.commit()
