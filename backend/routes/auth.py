from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from integrations.google_oauth import verify_google_id_token, verify_google_token_with_code
import os
import httpx
from urllib.parse import urlencode
from services.auth_service import create_access_token, verify_token
from database.mongodb import get_database
from models.user import UserInDB, UserResponse
from pymongo.errors import PyMongoError

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class GoogleAuthPayload(BaseModel):
    code: Optional[str] = None        # auth-code flow (unused for now)
    credential: Optional[str] = None  # JWT ID token from GoogleLogin button
    public_key: Optional[str] = None

class PublicKeyRegisterPayload(BaseModel):
    public_key: str


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
DRIVE_REDIRECT_URI = os.getenv(
    "GOOGLE_DRIVE_REDIRECT_URI",
    "http://localhost:8000/auth/google/drive/callback"
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid auth token")
        
    db = get_database()
    from bson import ObjectId
    try:
        user_dict = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user_dict = await db.users.find_one({"_id": user_id})
        
    if user_dict is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    mongo_id = str(user_dict["_id"])
    user_dict["id"] = mongo_id
    user_dict["_id"] = mongo_id
    if "created_at" not in user_dict:
        from datetime import datetime
        user_dict["created_at"] = datetime.utcnow()
    
    return UserResponse(**user_dict)

@router.post("/google")
async def google_login(payload: GoogleAuthPayload):
    # Determine which flow was used
    if payload.credential:
        # Default GoogleLogin button flow — JWT ID token
        idinfo = verify_google_id_token(payload.credential)
    elif payload.code:
        # Auth-code flow
        idinfo = await verify_google_token_with_code(payload.code)
    else:
        raise HTTPException(status_code=400, detail="No credential or code provided")

    if not idinfo:
        raise HTTPException(status_code=400, detail="Invalid Google profile data")
        
    # extract user info
    google_id = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", "Unknown")
    picture = idinfo.get("picture")
    drive_access_token = idinfo.get("access_token")
    drive_refresh_token = idinfo.get("refresh_token")
    drive_expires_in = idinfo.get("expires_in")
    
    # check if user exists
    db = get_database()
    try:
        user_dict = await db.users.find_one({"google_id": google_id})
        if not user_dict:
            from datetime import datetime
            from datetime import datetime, timedelta
            token_expiry = None
            if drive_expires_in:
                token_expiry = datetime.utcnow() + timedelta(seconds=int(drive_expires_in))

            new_user_dict = {
                "google_id": google_id,
                "email": email,
                "name": name,
                "picture": picture,
                "rsa_public_key": payload.public_key,
                "google_drive_access_token": drive_access_token,
                "google_drive_refresh_token": drive_refresh_token,
                "google_drive_token_expiry": token_expiry,
                "created_at": datetime.utcnow()
            }
            result = await db.users.insert_one(new_user_dict)
            user_id = str(result.inserted_id)
        else:
            user_id = str(user_dict["_id"])
            from datetime import datetime, timedelta
            update_fields = {}
            # Update public key if provided on new device
            if payload.public_key and user_dict.get("rsa_public_key") != payload.public_key:
                update_fields["rsa_public_key"] = payload.public_key

            if drive_access_token:
                update_fields["google_drive_access_token"] = drive_access_token
            if drive_refresh_token:
                update_fields["google_drive_refresh_token"] = drive_refresh_token
            if drive_expires_in:
                update_fields["google_drive_token_expiry"] = datetime.utcnow() + timedelta(seconds=int(drive_expires_in))

            if update_fields:
                await db.users.update_one({"_id": user_dict["_id"]}, {"$set": update_fields})
    except PyMongoError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Database unavailable. Cannot complete login right now. "
                "Check MongoDB Atlas network access/IP whitelist or local MongoDB availability."
            ),
        ) from exc
        
    # generate jwt
    access_token = create_access_token(data={"sub": user_id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

@router.get("/users/{user_id}/public-key")
async def get_user_public_key(user_id: str, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    try:
        user_dict = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user_dict = await db.users.find_one({"_id": user_id})
        
    if not user_dict or "rsa_public_key" not in user_dict or not user_dict.get("rsa_public_key"):
        raise HTTPException(status_code=404, detail="Public key not registered for this user")
        
    return {"rsa_public_key": user_dict["rsa_public_key"]}

@router.post("/register-public-key")
async def register_public_key(payload: PublicKeyRegisterPayload, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    try:
        query = {"_id": ObjectId(current_user.id)}
    except:
        query = {"_id": current_user.id}
        
    await db.users.update_one(query, {"$set": {"rsa_public_key": payload.public_key}})
    return {"message": "Public key registered successfully"}


@router.get("/google/drive/status")
async def google_drive_status(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    try:
        user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    except Exception:
        user = await db.users.find_one({"_id": current_user.id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    connected = bool(user.get("google_drive_refresh_token") or user.get("google_drive_access_token"))
    return {
        "connected": connected,
        "has_refresh_token": bool(user.get("google_drive_refresh_token")),
        "token_expiry": user.get("google_drive_token_expiry"),
    }


@router.get("/google/drive/connect-url")
async def google_drive_connect_url(request: Request, current_user: UserResponse = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_CLIENT_ID in backend environment")
    redirect_uri = DRIVE_REDIRECT_URI
    print(f"DRIVE REDIRECT URI: {redirect_uri}")

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/drive.file",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": current_user.id,
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"auth_url": url, "debug_redirect_uri": redirect_uri}


@router.get("/google/drive/callback")
@router.get("/google/drive/callback/")
async def google_drive_callback(request: Request, code: str, state: str):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Missing Google OAuth client configuration")

    redirect_uri = DRIVE_REDIRECT_URI

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to connect Google Drive")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")

    db = get_database()
    from bson import ObjectId
    from datetime import datetime, timedelta

    expiry = None
    if expires_in:
        try:
            expiry = datetime.utcnow() + timedelta(seconds=int(expires_in))
        except Exception:
            expiry = None

    update_fields = {
        "google_drive_access_token": access_token,
        "google_drive_token_expiry": expiry,
    }
    if refresh_token:
        update_fields["google_drive_refresh_token"] = refresh_token

    try:
        query = {"_id": ObjectId(state)}
    except Exception:
        query = {"_id": state}

    result = await db.users.update_one(query, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found for Drive callback")

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"{FRONTEND_URL}/?drive=connected")
