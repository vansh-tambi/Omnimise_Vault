from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.access import AccessCreate, AccessResponse, AccessInDB
from routes.auth import get_current_user
from database.mongodb import get_database

router = APIRouter(prefix="/access", tags=["access"])

@router.post("/share", response_model=AccessResponse)
async def share_access(acc: AccessCreate, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    
    # Check if document exists
    try:
        doc = await db.documents.find_one({"_id": ObjectId(acc.document_id)})
    except:
        doc = await db.documents.find_one({"_id": acc.document_id})
        
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check if user owns vault where the doc resides
    try:
        vault = await db.vaults.find_one({"_id": ObjectId(doc["vault_id"]), "user_id": current_user.id})
    except:
        vault = await db.vaults.find_one({"_id": doc["vault_id"], "user_id": current_user.id})
            
    if not vault:
        raise HTTPException(status_code=403, detail="Must own document's vault to share it")
        
    acc_db = AccessInDB(**acc.model_dump(), owner_id=current_user.id)
    acc_db_dict = acc_db.model_dump(by_alias=True, exclude_none=True)
    if "_id" in acc_db_dict:
        del acc_db_dict["_id"]
        
    result = await db.access.insert_one(acc_db_dict)
    acc_db.id = str(result.inserted_id)
    return acc_db

@router.get("/list", response_model=List[AccessResponse])
async def list_access(document_id: str, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    # Find access for this document where the current user is the one it was shared_with
    # or they are the owner
    from datetime import datetime
    
    cursor = db.access.find({"document_id": document_id, "$or": [{"shared_with": current_user.id}, {"owner_id": current_user.id}]})
    acts = []
    async for document in cursor:
        if document.get("shared_with") == current_user.id:
            expires_at = document.get("expires_at")
            if expires_at and expires_at <= datetime.utcnow():
                raise HTTPException(status_code=403, detail="Access has expired")
                
        document["_id"] = str(document["_id"])
        acts.append(AccessInDB(**document))
    return acts
