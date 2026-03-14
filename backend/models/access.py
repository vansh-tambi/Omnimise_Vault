from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class AccessBase(BaseModel):
    document_id: str
    shared_with: str
    encrypted_key_for_recipient: str
    permission: str = "read" # read, write
    expires_at: Optional[datetime] = None

class AccessCreate(AccessBase):
    pass

class AccessInDB(AccessBase):
    id: str = Field(alias="_id", default=None)
    owner_id: str
    granted_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class AccessResponse(AccessInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
