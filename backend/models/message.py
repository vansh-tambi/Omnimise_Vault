from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class MessageBase(BaseModel):
    receiver_id: str
    content: str
    vault_id: str

class MessageCreate(MessageBase):
    pass

class MessageInDB(MessageBase):
    id: str = Field(alias="_id", default=None)
    sender_id: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = False

    model_config = ConfigDict(populate_by_name=True)

class MessageResponse(MessageInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
