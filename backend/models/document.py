from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    vault_id: str
    content_type: str
    size_bytes: int

class DocumentCreate(DocumentBase):
    storage_url: str

class DocumentInDB(DocumentCreate):
    id: str = Field(alias="_id", default=None)
    owner_id: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(populate_by_name=True)

class DocumentResponse(DocumentBase):
    id: str
    owner_id: str
    uploaded_at: datetime
    model_config = ConfigDict(populate_by_name=True)
