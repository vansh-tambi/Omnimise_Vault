from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    id: Optional[str] = None
    mongo_id: Optional[str] = Field(default=None, validation_alias="_id", serialization_alias="_id")
    email: EmailStr
    google_id: Optional[str] = None
    name: str
    picture: Optional[str] = None
    rsa_public_key: Optional[str] = None
    digilocker_token: Optional[str] = None
    google_drive_refresh_token: Optional[str] = None
    google_drive_access_token: Optional[str] = None
    google_drive_token_expiry: Optional[datetime] = None


class UserCreate(UserBase):
    google_id: str


class UserInDB(UserCreate):
    created_at: Optional[datetime] = None
    model_config = ConfigDict(populate_by_name=True)


class UserResponse(UserBase):
    created_at: Optional[datetime] = None
    model_config = ConfigDict(populate_by_name=True)
