import asyncio
from app.core.database import async_session_factory
from app.modules.identity.service import IdentityService

async def check():
    async with async_session_factory() as db:
        svc = IdentityService(db)
        users = await svc.get_all_users()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f"- {u.email} ({u.role.name})")

if __name__ == "__main__":
    asyncio.run(check())
