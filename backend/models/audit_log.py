from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AuditLog(BaseModel):
    user_id: str
    action: str
    document_id: Optional[str] = None
    ip_address: str
    timestamp: datetime = datetime.utcnow()
