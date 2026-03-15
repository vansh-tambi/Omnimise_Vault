from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class VaultCreate(BaseModel):
    name: str
    description: Optional[str] = None
    vault_pin_hash: str
    vault_pin_salt: str


class VaultInDB(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    description: Optional[str] = None
    vault_pin_hash: str
    vault_pin_salt: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class VaultResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    vault_pin_hash: str
    vault_pin_salt: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
