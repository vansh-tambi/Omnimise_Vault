from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class RequestBase(BaseModel):
    vault_id: str
    target_user_id: str

class RequestCreate(RequestBase):
    pass

class RequestInDB(RequestBase):
    id: str = Field(alias="_id", default=None)
    requester_id: str
    status: str = "pending" # pending, approved, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = ConfigDict(populate_by_name=True)

class RequestResponse(RequestInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
