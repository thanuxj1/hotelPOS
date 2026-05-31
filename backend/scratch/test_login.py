import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response = client.post("/api/v1/auth/login", data={
    "username": "admin@hotelpos.demo",
    "password": "Admin@12345"
})

print(f"Status: {response.status_code}")
print(f"Body: {response.text}")
