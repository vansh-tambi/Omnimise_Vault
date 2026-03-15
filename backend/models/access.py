from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class AccessBase(BaseModel):
    document_id: str
    shared_with: str
    encrypted_key_for_recipient: str
    permission: str = "read" # read, write
    expires_at: Optional[datetime] = None
    max_views: Optional[int] = None
    current_views: int = 0

class AccessCreate(AccessBase):
    pass

class AccessInDB(AccessBase):
    id: Optional[str] = None
    owner_id: str
    granted_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

class AccessResponse(AccessBase):
    id: str
    owner_id: str
    granted_at: Optional[datetime] = None
    model_config = ConfigDict(populate_by_name=True)
