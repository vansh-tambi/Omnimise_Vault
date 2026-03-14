from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class MessageBase(BaseModel):
    receiver: str
    encrypted_message: str

class MessageCreate(MessageBase):
    pass

class MessageInDB(MessageBase):
    id: str = Field(alias="_id", default=None)
    sender: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_read: bool = False

    model_config = ConfigDict(populate_by_name=True)

class MessageResponse(MessageInDB):
    id: str
    model_config = ConfigDict(populate_by_name=True)
