from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
import os
from contextlib import asynccontextmanager
from database.mongodb import connect_to_mongo, close_mongo_connection
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, vault, documents, requests, access, messages, audit
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

_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        _frontend_url,
        "http://localhost:5173",
        "http://localhost:5174",
    ],
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
app.include_router(audit.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Secure Document Vault API"}

@app.get("/local-files/{file_path:path}")
async def get_local_file(
    file_path: str, 
    current_user: auth.UserResponse = Depends(auth.get_current_user)
):
    if not file_path.startswith(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this file")
        
    local_storage_path = os.path.join(os.path.dirname(__file__), "local_storage", file_path)
    
    if not os.path.exists(local_storage_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    def iterfile():
        with open(local_storage_path, "rb") as f:
            yield from f
            
    return StreamingResponse(iterfile(), media_type="application/octet-stream")

@app.post("/backup/trigger")
async def manual_backup_trigger(current_user: auth.UserResponse = Depends(auth.get_current_user)):
    from integrations.google_drive import backup_user_vault
    import asyncio
    
    # We trigger the backup in a background task to prevent blocking the HTTP response
    asyncio.create_task(backup_user_vault(current_user.id))
    return {"message": f"Backup manually triggered successfully for {current_user.id}"}
