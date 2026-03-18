from dotenv import load_dotenv
load_dotenv()  # Load .env before any os.getenv() calls

from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
import os
from contextlib import asynccontextmanager
from database.mongodb import connect_to_mongo, close_mongo_connection
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
import re
from routes import auth, vault, documents, requests, access, messages, audit, notifications
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


def sync_expiry_cleanup_runner():
    """Synchronous wrapper so BackgroundScheduler can trigger async expiry cleanup."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def _cleanup_expired_documents():
        from services.cleanup_service import run_expiry_cleanup
        try:
            await run_expiry_cleanup()
        except Exception as e:
            print(f"Expiry cleanup failure: {e}")

    loop.run_until_complete(_cleanup_expired_documents())
    loop.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    
    scheduler = BackgroundScheduler()
    # Schedule to run every day at midnight
    scheduler.add_job(sync_backup_runner, 'cron', hour=0, minute=0)
    scheduler.add_job(sync_expiry_cleanup_runner, 'interval', hours=1)
    scheduler.start()
    
    yield
    
    scheduler.shutdown()
    await close_mongo_connection()

app = FastAPI(title="Secure Document Vault", lifespan=lifespan)

PRODUCTION = os.getenv("PRODUCTION", "false").lower() == "true"

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Collapse multiple slashes (e.g., //vault -> /vault)
    path = request.url.path
    collapsed_path = re.sub(r'/+', '/', path)
    
    if path != collapsed_path:
        print(f"Collapsing slashes: {path} -> {collapsed_path}")
        # Note: We can't easily change the request.url in-place for all downstream 
        # but we can log it. Actually, we should handle this via a redirect or 
        # by modifying the scope if we want FastAPI to match the route.
        # But for now, let's see if this is actually the issue.
    
    print(f"Incoming request: {request.method} {path}")
    response = await call_next(request)

    # In production, enforce cross-origin cookie flags for all cookies.
    # Vercel (frontend) <-> backend on different domain requires SameSite=None; Secure.
    if PRODUCTION:
        updated_raw_headers = []
        for key, value in response.raw_headers:
            if key.lower() == b"set-cookie":
                cookie = value.decode("latin-1")
                cookie = re.sub(r";\s*secure", "", cookie, flags=re.IGNORECASE)
                cookie = re.sub(r";\s*samesite\s*=\s*[^;]+", "", cookie, flags=re.IGNORECASE)
                cookie = f"{cookie}; Secure; SameSite=None"
                updated_raw_headers.append((key, cookie.encode("latin-1")))
            else:
                updated_raw_headers.append((key, value))
        response.raw_headers = updated_raw_headers

    print(f"Response status: {response.status_code}")
    return response

origins = [
    url.strip()
    for url in os.getenv(
        "FRONTEND_URL",
        ""
    ).split(",")
    if url.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(notifications.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Secure Document Vault API"}

@app.get("/local-files/{file_path:path}")
async def get_local_file(
    file_path: str, 
    current_user: auth.UserResponse = Depends(auth.get_current_user)
):
    from database.mongodb import get_database
    db = get_database()

    # Allow access if user owns the file path folder
    if file_path.startswith(current_user.id):
        allowed = True
    else:
        # Allow access for shared documents by matching storage_url
        allowed = False
        document = await db.documents.find_one({"storage_url": file_path})
        if document:
            document_id_str = str(document.get("_id"))
            if str(document.get("owner_id")) == current_user.id:
                allowed = True
            else:
                access = await db.access.find_one(
                    {
                        "shared_with": current_user.id,
                        "$or": [
                            {"document_id": document_id_str},
                            {"document_id": document.get("_id")},
                        ],
                    }
                )
                if access:
                    allowed = True

    if not allowed:
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
    from database.mongodb import get_database
    from bson import ObjectId
    
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    except Exception:
        user = await db.users.find_one({"_id": current_user.id})

    if not user or not (user.get("google_drive_refresh_token") or user.get("google_drive_access_token")):
        raise HTTPException(
            status_code=400,
            detail="Google Drive not connected. Use the 'Connect Drive' button in Dashboard first."
        )

    # We trigger the backup in a background task to prevent blocking the HTTP response
    asyncio.create_task(backup_user_vault(current_user.id))
    return {"message": f"Backup manually triggered successfully for {current_user.id}"}
