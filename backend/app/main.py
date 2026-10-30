from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.database import init_db
from app.services.websocket_manager import ws_manager
from app.routes import dashboard, sourcemark, privypass, trusttest, evidencelock, reports

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TrustSphere AI backend…")
    init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down…")

app = FastAPI(
    title="TrustSphere AI",
    description="Content integrity, privacy verification, AI security testing, tamper-evident evidence",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard.router)
app.include_router(sourcemark.router)
app.include_router(privypass.router)
app.include_router(trusttest.router)
app.include_router(evidencelock.router)
app.include_router(reports.router)

@app.get("/api/health")
def health():
    from app.database import engine
    try:
        with engine.connect() as conn:
            conn.execute(__import__('sqlalchemy').text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy",
        "database": db_status,
        "modules": {
            "sourcemark": "active",
            "privypass": "active",
            "trusttest": "active",
            "evidencelock": "active",
        },
        "websocket": "running",
        "version": "1.0.0",
    }

@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive / ping
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)

