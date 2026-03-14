import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from urllib.parse import urlencode
from routes.auth import get_current_user
from database.mongodb import get_database
from models.user import UserResponse

router = APIRouter(prefix="/digilocker", tags=["digilocker"])

DIGILOCKER_CLIENT_ID = os.getenv("DIGILOCKER_CLIENT_ID", "mock_client")
DIGILOCKER_CLIENT_SECRET = os.getenv("DIGILOCKER_CLIENT_SECRET", "mock_secret")
DIGILOCKER_REDIRECT_URI = os.getenv("DIGILOCKER_REDIRECT_URI", "http://localhost:8000/digilocker/callback")

# API Base
AUTH_URL = "https://api.digitallocker.gov.in/public/oauth2/1/authorize"
TOKEN_URL = "https://api.digitallocker.gov.in/public/oauth2/1/token"
FILES_URL = "https://api.digitallocker.gov.in/public/oauth2/1/files"
FILE_DOWNLOAD_URL = "https://api.digitallocker.gov.in/public/oauth2/1/file"

@router.get("/auth")
async def digilocker_auth(current_user: UserResponse = Depends(get_current_user)):
    """Redirects user to the DigiLocker OAuth page. 
    We pass the user ID in the state so we know who authorized it on callback."""
    params = {
        "response_type": "code",
        "client_id": DIGILOCKER_CLIENT_ID,
        "redirect_uri": DIGILOCKER_REDIRECT_URI,
        "scope": "r1",
        "state": current_user.id
    }
    url = f"{AUTH_URL}?{urlencode(params)}"
    return {"url": url}

@router.get("/callback")
async def digilocker_callback(code: str, state: str):
    """Exchanges the authorization code for an access token, stores it in MongoDB."""
    user_id = state
    
    async with httpx.AsyncClient() as client:
        # Standard OAuth2 Token Exchange
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": DIGILOCKER_CLIENT_ID,
            "client_secret": DIGILOCKER_CLIENT_SECRET,
            "redirect_uri": DIGILOCKER_REDIRECT_URI
        }
        resp = await client.post(TOKEN_URL, data=payload)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to retrieve token from DigiLocker")
            
        data = resp.json()
        access_token = data.get("access_token")
        
        # Store in MongoDB
        db = get_database()
        from bson import ObjectId
        try:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"digilocker_token": access_token}}
            )
        except Exception:
            await db.users.update_one(
                {"_id": user_id},
                {"$set": {"digilocker_token": access_token}}
            )
            
    # Normally, redirect back to frontend dashboard
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173/dashboard?digilocker=success")
    return RedirectResponse(url=frontend_url)

@router.get("/documents")
async def list_digilocker_documents(current_user: UserResponse = Depends(get_current_user)):
    """Fetches the document list using the stored DigiLocker access token."""
    db = get_database()
    from bson import ObjectId
    try:
        user_dict = await db.users.find_one({"_id": ObjectId(current_user.id)})
    except Exception:
        user_dict = await db.users.find_one({"_id": current_user.id})
        
    token = user_dict.get("digilocker_token")
    if not token:
        raise HTTPException(status_code=401, detail="DigiLocker not connected")
        
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get(FILES_URL, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch documents from DigiLocker")
            
        return resp.json()

@router.post("/import/{doc_uri:path}")
async def import_digilocker_document(doc_uri: str, current_user: UserResponse = Depends(get_current_user)):
    """
    Downloads the specific document from DigiLocker using the assigned URI, 
    then streams the raw plaintext bytes down to the frontend so it can 
    immediately encrypt it with the zero-knowledge vault key.
    """
    db = get_database()
    from bson import ObjectId
    try:
        user_dict = await db.users.find_one({"_id": ObjectId(current_user.id)})
    except Exception:
        user_dict = await db.users.find_one({"_id": current_user.id})
        
    token = user_dict.get("digilocker_token")
    if not token:
        raise HTTPException(status_code=401, detail="DigiLocker not connected")
        
    async def fetch_and_stream():
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            # We hit the file download endpoint with the given URI
            target = f"{FILE_DOWNLOAD_URL}/{doc_uri}"
            async with client.stream("GET", target, headers=headers) as dl_resp:
                if dl_resp.status_code != 200:
                    yield b"Error fetching document"
                    return
                # Stream the chunks exactly as received so large files don't hang memory
                async for chunk in dl_resp.aiter_bytes():
                    yield chunk
                    
    # We return the stream as a standard octet stream so React receives the continuous Blob
    return StreamingResponse(fetch_and_stream(), media_type="application/octet-stream")
