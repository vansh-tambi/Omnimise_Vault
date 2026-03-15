from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    vault_id: str
    content_type: str
    size_bytes: int
    self_destruct_after_views: Optional[int] = None
    self_destruct_at: Optional[datetime] = None
    view_count: int = 0

class DocumentCreate(DocumentBase):
    storage_url: str

class DocumentInDB(DocumentCreate):
    id: str = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow) # Changed from uploaded_at to created_at

    model_config = ConfigDict(populate_by_name=True)

class DocumentResponse(DocumentBase):
    id: str
    vault_id: str
    created_at: datetime
    model_config = ConfigDict(populate_by_name=True)
