from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from models.user import UserResponse
from models.access import AccessCreate, AccessResponse, AccessInDB
from routes.auth import get_current_user
from database.mongodb import get_database
from services.audit_service import log_action

router = APIRouter(prefix="/access", tags=["access"])

@router.post("/share", response_model=AccessResponse)
async def share_access(acc: AccessCreate, request: Request, current_user: UserResponse = Depends(get_current_user)):
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
        
    from datetime import datetime
    acc_dict = acc.model_dump()
    acc_dict["owner_id"] = current_user.id
    acc_dict["granted_at"] = datetime.utcnow()
    
    result = await db.access.insert_one(acc_dict)
    acc_dict["id"] = str(result.inserted_id)
    
    await log_action(db, current_user.id, "file_shared", request, document_id=str(doc.get("_id")))
    
    return AccessInDB(**acc_dict)

@router.get("/lookup_user")
async def lookup_user(email: str, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "rsa_public_key": user.get("rsa_public_key")
    }

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
                continue # Skip expired access
                
        document["_id"] = str(document["_id"])
        acts.append(AccessInDB(**document))
    return acts

@router.get("/received")
async def list_received_shares(current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from datetime import datetime
    from bson import ObjectId
    
    cursor = db.access.find({
        "shared_with": current_user.id,
        "$or": [
            {"expires_at": {"$gt": datetime.utcnow()}},
            {"expires_at": None}
        ]
    })
    
    results = []
    async for share in cursor:
        doc_id = share["document_id"]
        try:
            doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        except:
            doc = await db.documents.find_one({"_id": doc_id})
            
        if doc:
            results.append({
                "access_id": str(share["_id"]),
                "document_id": doc_id,
                "filename": doc["filename"],
                "owner_id": share["owner_id"],
                "granted_at": share["granted_at"],
                "expires_at": share.get("expires_at"),
                "encrypted_key_for_recipient": share["encrypted_key_for_recipient"]
            })
    return results
