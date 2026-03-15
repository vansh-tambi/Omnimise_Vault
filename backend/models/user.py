from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None
    rsa_public_key: Optional[str] = None
    digilocker_token: Optional[str] = None

class UserCreate(UserBase):
    google_id: str

class UserInDB(UserCreate):
    id: str = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class UserResponse(UserBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)
