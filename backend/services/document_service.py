from database.mongodb import get_database
from models.document import DocumentInDB, DocumentCreate
from bson import ObjectId
from typing import List

async def create_document(doc_data: DocumentCreate, user_id: str) -> DocumentInDB:
    db = get_database()
    doc_dict = doc_data.model_dump()
    doc_dict["owner_id"] = user_id
    
    doc_db = DocumentInDB(**doc_dict)
    doc_db_dict = doc_db.model_dump(by_alias=True, exclude_none=True)
    if "_id" in doc_db_dict:
        del doc_db_dict["_id"]
        
    result = await db.documents.insert_one(doc_db_dict)
    doc_db.id = str(result.inserted_id)
    return doc_db

async def get_documents_by_vault(vault_id: str) -> List[DocumentInDB]:
    db = get_database()
    cursor = db.documents.find({"vault_id": vault_id})
    docs = []
    async for document in cursor:
        document["_id"] = str(document["_id"])
        docs.append(DocumentInDB(**document))
    return docs

async def get_document_by_id(doc_id: str) -> DocumentInDB:
    db = get_database()
    try:
        query = {"_id": ObjectId(doc_id)}
    except:
        query = {"_id": doc_id}  # depending on how IDs are stored
        
    doc = await db.documents.find_one(query)
    if not doc:
        # Fallback to string if object ID failed or stored as string
        doc = await db.documents.find_one({"_id": doc_id})
        
    if doc:
        doc["_id"] = str(doc["_id"])
        return DocumentInDB(**doc)
    return None
