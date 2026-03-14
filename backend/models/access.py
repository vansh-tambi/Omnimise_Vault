from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class AccessBase(BaseModel):
    vault_id: str
    user_id: str
    permission: str = "read" # read, write

class AccessCreate(AccessBase):
    pass

class AccessInDB(AccessBase):
    id: str = Field(alias="_id", default=None)
    granted_by: str
    granted_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class AccessResponse(AccessInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
