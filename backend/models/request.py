from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class RequestCreate(BaseModel):
    target_user_email: str   # Email of the user being asked for a document
    document_type: str       # Description of what's being requested (e.g. "Passport", "Pay Slip")


class RequestInDB(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    requester_id: str
    target_user_id: str      # Resolved from target_user_email on creation
    target_user_email: str
    document_type: str
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)


class RequestResponse(RequestInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
