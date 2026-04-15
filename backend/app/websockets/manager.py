import json
import logging
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

websocket_router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections, grouped by tenant and channel."""

    def __init__(self):
        # { tenant_id: { channel: Set[WebSocket] } }
        self._connections: Dict[str, Dict[str, Set[WebSocket]]] = {}

    def _get_channel(self, tenant_id: str, channel: str) -> Set[WebSocket]:
        return self._connections.setdefault(tenant_id, {}).setdefault(channel, set())

    async def connect(self, ws: WebSocket, tenant_id: str, channel: str):
        await ws.accept()
        self._get_channel(tenant_id, channel).add(ws)
        logger.info(f"WS connected — tenant={tenant_id}, channel={channel}")

    def disconnect(self, ws: WebSocket, tenant_id: str, channel: str):
        channel_set = self._get_channel(tenant_id, channel)
        channel_set.discard(ws)
        logger.info(f"WS disconnected — tenant={tenant_id}, channel={channel}")

    async def broadcast(self, tenant_id: str, channel: str, message: dict):
        """Broadcast a JSON message to all connections on a channel."""
        payload = json.dumps(message)
        dead = set()
        for ws in self._get_channel(tenant_id, channel):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, tenant_id, channel)

    async def broadcast_all_channels(self, tenant_id: str, message: dict):
        """Broadcast to all channels for a tenant (e.g. system alerts)."""
        for channel in list(self._connections.get(tenant_id, {}).keys()):
            await self.broadcast(tenant_id, channel, message)


manager = ConnectionManager()


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────

@websocket_router.websocket("/orders/{tenant_id}")
async def ws_orders(ws: WebSocket, tenant_id: str):
    """Kitchen display / order tracking channel."""
    await manager.connect(ws, tenant_id, "orders")
    try:
        while True:
            data = await ws.receive_text()
            # Echo ping/pong to keep connection alive
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws, tenant_id, "orders")


@websocket_router.websocket("/rooms/{tenant_id}")
async def ws_rooms(ws: WebSocket, tenant_id: str):
    """Room status updates channel (housekeeping dashboard)."""
    await manager.connect(ws, tenant_id, "rooms")
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws, tenant_id, "rooms")


@websocket_router.websocket("/dashboard/{tenant_id}")
async def ws_dashboard(ws: WebSocket, tenant_id: str):
    """General dashboard stats channel."""
    await manager.connect(ws, tenant_id, "dashboard")
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws, tenant_id, "dashboard")
