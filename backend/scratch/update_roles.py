import asyncio
from app.core.database import async_session_factory
from app.modules.identity.service import IdentityService
from app.core.tenant import set_tenant_id

async def update_roles():
    async with async_session_factory() as db:
        svc = IdentityService(db)
        
        # We need to bypass the "if existing: return" by manually calling the logic or a modified version
        # But wait, I can just manually update the roles here.
        from app.modules.identity.models import Role, Permission
        from sqlalchemy.future import select
        
        perms_res = await db.execute(select(Permission))
        perms = {p.name: p for p in perms_res.scalars().all()}
        
        roles_config = {
            "receptionist": [
                "rooms:read", "reservations:read", "reservations:write",
                "guests:read", "guests:write", "billing:read", "billing:write", "pos:read", "pos:write",
            ],
            "kitchen": ["pos:read", "pos:write", "reservations:read", "rooms:read"],
            "cashier": ["billing:read", "billing:write", "pos:read", "pos:write", "reservations:read", "rooms:read"],
        }
        
        for role_name, perm_names in roles_config.items():
            role_res = await db.execute(select(Role).where(Role.name == role_name))
            role = role_res.scalars().first()
            if role:
                role_perms = [perms[pn] for pn in perm_names if pn in perms]
                role.permissions = role_perms
                print(f"Updated role: {role_name}")
        
        await db.commit()
        print("Done updating roles.")

if __name__ == "__main__":
    asyncio.run(update_roles())
