from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from integrations.google_oauth import verify_google_id_token, verify_google_token_with_code
from services.auth_service import create_access_token, verify_token
from database.mongodb import get_database
from models.user import UserInDB, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class GoogleAuthPayload(BaseModel):
    code: Optional[str] = None        # auth-code flow (unused for now)
    credential: Optional[str] = None  # JWT ID token from GoogleLogin button
    public_key: Optional[str] = None

class PublicKeyRegisterPayload(BaseModel):
    public_key: str

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
    
    # Map MongoDB _id to id and ensure required fields exist
    user_dict["id"] = str(user_dict.pop("_id"))
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
    
    # check if user exists
    db = get_database()
    user_dict = await db.users.find_one({"google_id": google_id})
    if not user_dict:
        from datetime import datetime
        new_user_dict = {
            "google_id": google_id,
            "email": email,
            "name": name,
            "picture": picture,
            "rsa_public_key": payload.public_key,
            "created_at": datetime.utcnow()
        }
        result = await db.users.insert_one(new_user_dict)
        user_id = str(result.inserted_id)
    else:
        user_id = str(user_dict["_id"])
        # Update public key if provided on new device
        if payload.public_key and user_dict.get("rsa_public_key") != payload.public_key:
            await db.users.update_one({"_id": user_dict["_id"]}, {"$set": {"rsa_public_key": payload.public_key}})
        
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
