from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from integrations.google_oauth import verify_google_token
from services.auth_service import create_access_token, verify_token
from database.mongodb import get_database
from models.user import UserInDB, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class GoogleToken(BaseModel):
    token: str

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
    
    user_dict["_id"] = str(user_dict["_id"])
    return UserResponse(**user_dict)

@router.post("/google")
async def google_login(token_data: GoogleToken):
    # verify token string from frontend
    idinfo = await verify_google_token(token_data.token)
    if not idinfo:
        raise HTTPException(status_code=400, detail="Invalid Google token")
        
    # extract user info
    google_id = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", "Unknown")
    picture = idinfo.get("picture")
    
    # check if user exists
    db = get_database()
    user_dict = await db.users.find_one({"google_id": google_id})
    if not user_dict:
        # Create user
        new_user = UserInDB(
            google_id=google_id,
            email=email,
            name=name,
            picture=picture
        )
        new_user_dict = new_user.model_dump(by_alias=True, exclude_none=True)
        if "_id" in new_user_dict:
            del new_user_dict["_id"]
            
        result = await db.users.insert_one(new_user_dict)
        user_id = str(result.inserted_id)
    else:
        user_id = str(user_dict["_id"])
        
    # generate jwt
    access_token = create_access_token(data={"sub": user_id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user
