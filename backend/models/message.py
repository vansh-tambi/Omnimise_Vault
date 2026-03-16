from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class MessageCreate(BaseModel):
    receiver_id: str  # Target user ID (looked up by email on frontend)
    encrypted_message: str


class MessageInDB(MessageCreate):
    id: Optional[str] = Field(alias="_id", default=None)
    sender_id: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False
    read_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    encrypted_message: str
    sent_at: datetime
    read: bool
    read_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
