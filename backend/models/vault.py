from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class VaultCreate(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    pin_verifier: str


class VaultUnlock(BaseModel):
    pin: str

class VaultInDB(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    description: Optional[str] = None
    pin_verifier: Optional[str] = None
    created_at: Optional[datetime] = None
    self_destruct_views: Optional[int] = None
    self_destruct_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class VaultResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    pin_verifier: Optional[str] = None
    created_at: Optional[datetime] = None
    self_destruct_views: Optional[int] = None
    self_destruct_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
