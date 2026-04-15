"""
Seed script — bootstraps a fresh database with:
  - Default permissions and roles
  - A super-admin user for `demo_hotel` tenant
  - Sample room types and rooms
  - Sample menu categories and items

Run with:
    python -m app.seed
from the /backend directory (after `alembic upgrade head`).
"""

import asyncio
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine, Base
from app.core.tenant import set_tenant_id
from app.modules.identity.service import IdentityService
from app.modules.identity.schemas import UserCreate
from app.modules.hotel.service import HotelService
from app.modules.hotel.schemas import RoomTypeCreate, RoomCreate
from app.modules.pos.service import POSService
from app.modules.pos.schemas import MenuCategoryCreate, MenuItemCreate

# Import all models so that Base.metadata is populated before create_all
import app.modules.identity.models  # noqa
import app.modules.hotel.models  # noqa
import app.modules.pos.models  # noqa
import app.modules.billing.models  # noqa

TENANT_ID = "demo_hotel"
ADMIN_EMAIL = "admin@hotelpos.demo"
ADMIN_PASSWORD = "Admin@12345"


async def seed():
    try:
        # Create tables (dev convenience — use Alembic in production)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        set_token = set_tenant_id(TENANT_ID)

        async with async_session_factory() as db:
            await _seed_identity(db)
            await _seed_hotel(db)
            await _seed_pos(db)

        print("\n[SUCCESS] Database seeded successfully!")
        print(f"    Tenant  : {TENANT_ID}")
        print(f"    Admin   : {ADMIN_EMAIL}")
        print(f"    Password: {ADMIN_PASSWORD}")
    finally:
        # Dispose of the engine to prevent transport close errors after the event loop is closed
        await engine.dispose()


async def _seed_identity(db: AsyncSession):
    svc = IdentityService(db)

    # 1. Seed permissions & roles (idempotent)
    await svc.seed_permissions_and_roles()
    print("  [OK] Permissions & roles seeded")

    # 2. Create super_admin user if not exists
    existing = await svc.get_user_by_email(ADMIN_EMAIL)
    if not existing:
        roles = await svc.get_roles()
        admin_role = next((r for r in roles if r.name == "super_admin"), None)
        if admin_role:
            await svc.create_user(UserCreate(
                email=ADMIN_EMAIL,
                password=ADMIN_PASSWORD,
                full_name="Hotel Admin",
                role_id=admin_role.id,
                tenant_id=TENANT_ID,
            ))
            print(f"  [OK] Admin user created: {ADMIN_EMAIL}")
    else:
        print(f"  [OK] Admin user already exists: {ADMIN_EMAIL}")
    # 3. Create kitchen user if not exists
    KITCHEN_EMAIL = "kitchen@hotelpos.demo"
    existing_kitchen = await svc.get_user_by_email(KITCHEN_EMAIL)
    if not existing_kitchen:
        roles = await svc.get_roles()
        kitchen_role = next((r for r in roles if r.name == "kitchen"), None)
        if kitchen_role:
            await svc.create_user(UserCreate(
                email=KITCHEN_EMAIL,
                password=ADMIN_PASSWORD,
                full_name="Kitchen Staff",
                role_id=kitchen_role.id,
                tenant_id=TENANT_ID,
            ))
            print(f"  [OK] Kitchen user created: {KITCHEN_EMAIL}")
    else:
        print(f"  [OK] Kitchen user already exists: {KITCHEN_EMAIL}")

async def _seed_hotel(db: AsyncSession):
    svc = HotelService(db)
    existing_types = await svc.get_room_types()
    if existing_types:
        print("  [OK] Room types already exist - skipping")
        return

    room_types_data = [
        RoomTypeCreate(name="Standard", base_price=Decimal("2500"), capacity=2,
                       description="Comfortable standard room with garden view",
                       amenities="WiFi, AC, TV, Mini-fridge"),
        RoomTypeCreate(name="Deluxe", base_price=Decimal("4500"), capacity=2,
                       description="Spacious deluxe room with city view",
                       amenities="WiFi, AC, TV, Mini-bar, Bathtub"),
        RoomTypeCreate(name="Suite", base_price=Decimal("8000"), capacity=4,
                       description="Luxury suite with living area and pool view",
                       amenities="WiFi, AC, 2x TV, Full Bar, Jacuzzi, Butler Service"),
        RoomTypeCreate(name="Family Room", base_price=Decimal("5500"), capacity=5,
                       description="Large family room with separate sleeping areas",
                       amenities="WiFi, AC, 2x TV, Mini-fridge, Extra Beds"),
    ]
    room_types = []
    for rt_in in room_types_data:
        rt = await svc.create_room_type(rt_in)
        room_types.append(rt)
    print(f"  [OK] {len(room_types)} room types created")

    # Create sample rooms
    rooms_data = [
        # Floor 1 - Standard
        {"room_number": "101", "floor": 1, "type_idx": 0},
        {"room_number": "102", "floor": 1, "type_idx": 0},
        {"room_number": "103", "floor": 1, "type_idx": 0},
        {"room_number": "104", "floor": 1, "type_idx": 0},
        # Floor 2 - Deluxe
        {"room_number": "201", "floor": 2, "type_idx": 1},
        {"room_number": "202", "floor": 2, "type_idx": 1},
        {"room_number": "203", "floor": 2, "type_idx": 1},
        # Floor 3 - Suites + Family
        {"room_number": "301", "floor": 3, "type_idx": 2},
        {"room_number": "302", "floor": 3, "type_idx": 2},
        {"room_number": "303", "floor": 3, "type_idx": 3},
    ]
    for r in rooms_data:
        await svc.create_room(RoomCreate(
            room_number=r["room_number"],
            floor=r["floor"],
            room_type_id=room_types[r["type_idx"]].id,
        ))
    print(f"  [OK] {len(rooms_data)} rooms created")


async def _seed_pos(db: AsyncSession):
    svc = POSService(db)
    existing = await svc.get_categories()
    if existing:
        print("  [OK] Menu already exists - skipping")
        return

    categories = {
        "Breakfast": [
            ("Continental Breakfast", "Croissant, butter, jam, orange juice", Decimal("350")),
            ("Full English Breakfast", "Eggs, bacon, sausage, beans, toast", Decimal("550")),
            ("Masala Omelette", "3-egg omelette with spices and vegetables", Decimal("280")),
            ("Fresh Fruit Platter", "Seasonal fruits with honey yogurt", Decimal("220")),
        ],
        "Main Course": [
            ("Butter Chicken", "Creamy tomato-based chicken curry with naan", Decimal("420")),
            ("Paneer Tikka Masala", "Cottage cheese in rich gravy (V)", Decimal("380")),
            ("Club Sandwich", "Triple-decker with chicken, egg, and veggies", Decimal("320")),
            ("Grilled Fish", "Basa fillet with lemon butter sauce and fries", Decimal("480")),
            ("Veg Biryani", "Fragrant rice with mixed vegetables (V)", Decimal("350")),
            ("Chicken Biryani", "Dum-style with raita and salan", Decimal("450")),
        ],
        "Starters": [
            ("Chicken Wings", "Crispy wings with buffalo sauce", Decimal("320")),
            ("Paneer Tikka", "Marinated cottage cheese, tandoor (V)", Decimal("280")),
            ("Prawn Cocktail", "Chilled prawns with Marie Rose sauce", Decimal("420")),
            ("Veg Spring Rolls", "Crispy rolls with sweet chili dip (V)", Decimal("220")),
        ],
        "Beverages": [
            ("Fresh Lime Soda", "Sweet or salted", Decimal("80")),
            ("Mango Lassi", "Chilled yogurt mango drink", Decimal("120")),
            ("Masala Chai", "Spiced Indian milk tea", Decimal("60")),
            ("Cappuccino", "Espresso with steamed milk foam", Decimal("180")),
            ("Fresh Orange Juice", "Freshly squeezed", Decimal("150")),
            ("Mineral Water (1L)", "", Decimal("60")),
        ],
        "Desserts": [
            ("Gulab Jamun", "2 pieces with vanilla ice cream", Decimal("180")),
            ("Chocolate Lava Cake", "Warm cake with molten center", Decimal("280")),
            ("Ice Cream (2 scoops)", "Vanilla, Chocolate, or Strawberry", Decimal("160")),
        ],
    }

    for cat_name, items in categories.items():
        cat = await svc.create_category(MenuCategoryCreate(name=cat_name))
        for item_name, desc, price in items:
            await svc.create_item(MenuItemCreate(
                name=item_name,
                description=desc,
                price=price,
                category_id=cat.id,
            ))
    total_items = sum(len(v) for v in categories.values())
    print(f"  [OK] {len(categories)} menu categories and {total_items} items created")


if __name__ == "__main__":
    asyncio.run(seed())
