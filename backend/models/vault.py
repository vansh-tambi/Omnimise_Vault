from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class VaultBase(BaseModel):
    name: str
    description: Optional[str] = None

class VaultCreate(VaultBase):
    pass

class VaultInDB(VaultBase):
    id: str = Field(alias="_id", default=None)
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class VaultResponse(VaultInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
