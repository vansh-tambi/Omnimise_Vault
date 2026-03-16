from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class NotificationInDB(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    user_id: str
    type: str
    message: str
    request_id: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    data: Optional[dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True)


class NotificationResponse(NotificationInDB):
    id: str
    request_status: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True)