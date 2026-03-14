from fastapi import FastAPI
import os
from contextlib import asynccontextmanager
from database.mongodb import connect_to_mongo, close_mongo_connection
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, vault, documents, requests, access, messages
from integrations import digilocker
from apscheduler.schedulers.background import BackgroundScheduler
import asyncio

def sync_backup_runner():
    """Synchronous wrapper so BackgroundScheduler can trigger async motor operations."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    async def _backup_all():
        from database.mongodb import get_database
        from integrations.google_drive import backup_user_vault
        try:
            db = get_database()
            cursor = db.users.find({})
            async for user in cursor:
                await backup_user_vault(str(user["_id"]))
        except Exception as e:
            print(f"Global backup failure: {e}")
            
    loop.run_until_complete(_backup_all())
    loop.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    
    scheduler = BackgroundScheduler()
    # Schedule to run every day at midnight
    scheduler.add_job(sync_backup_runner, 'cron', hour=0, minute=0)
    scheduler.start()
    
    yield
    
    scheduler.shutdown()
    await close_mongo_connection()

app = FastAPI(title="Secure Document Vault", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vault.router)
app.include_router(documents.router)
app.include_router(requests.router)
app.include_router(access.router)
app.include_router(messages.router)
app.include_router(digilocker.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Secure Document Vault API"}

@app.post("/backup/trigger")
async def manual_backup_trigger(current_user: auth.UserResponse = auth.Depends(auth.get_current_user)):
    from integrations.google_drive import backup_user_vault
    import asyncio
    
    # We trigger the backup in a background task to prevent blocking the HTTP response
    asyncio.create_task(backup_user_vault(current_user.id))
    return {"message": f"Backup manually triggered successfully for {current_user.id}"}
