from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class RequestCreate(BaseModel):
    target_identifier: str
    document_type: str
    description: Optional[str] = None


class RequestInDB(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    requester_id: str
    requester_email: str
    target_user_id: str
    document_type: str
    description: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    fulfilled_vault_id: Optional[str] = None
    fulfilled_at: Optional[datetime] = None
    target_user_email: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class RequestResponse(RequestInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)


class RequestRespond(BaseModel):
    request_id: str
    action: str
