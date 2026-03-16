from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List
from models.user import UserResponse
from models.vault import VaultCreate, VaultResponse, VaultUnlock
from services.vault_service import create_vault, get_user_vaults, check_vault_access
from services.audit_service import log_action
from database.mongodb import get_database
from routes.auth import get_current_user

router = APIRouter(prefix="/vault", tags=["vault"])

@router.post("/create", response_model=VaultResponse)
async def create_new_vault(vault: VaultCreate, current_user: UserResponse = Depends(get_current_user)):
    return await create_vault(vault, current_user.id)

@router.get("", response_model=List[VaultResponse])
async def list_vaults(current_user: UserResponse = Depends(get_current_user)):
    return await get_user_vaults(current_user.id)

@router.post("/{id}/unlock")
async def unlock_vault(id: str, request: Request, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    
    try:
        vault = await db.vaults.find_one({"_id": ObjectId(id)})
    except:
        vault = await db.vaults.find_one({"_id": id})
        
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")

    has_access = await check_vault_access(id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
    
    # Server-side PIN hash verification is removed globally.
    # The frontend now decrypts the pin_verifier string client-side directly
    # providing full zero-knowledge pin verification.
    
    await log_action(db, current_user.id, "vault_unlocked", request)
    return {"message": "Vault unlocked and logged"}

@router.delete("/{id}")
async def delete_vault(id: str, request: Request, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    from integrations.gcs_storage import delete_file
    
    print(f"Delete attempt for vault {id} by user {current_user.id}")
    
    # Step 1: Find vault by ID only (handle both ObjectId and string formats)
    try:
        vault = await db.vaults.find_one({"_id": ObjectId(id)})
    except Exception:
        vault = await db.vaults.find_one({"_id": id})
    
    if not vault:
        print(f"Vault {id} does not exist at all")
        raise HTTPException(status_code=404, detail="Vault not found")
    
    # Step 2: Check ownership separately by comparing user_id as strings
    stored_user_id = str(vault.get("user_id", ""))
    if stored_user_id != current_user.id:
        print(f"Ownership mismatch: vault owner={stored_user_id}, requester={current_user.id}")
        raise HTTPException(status_code=403, detail="Not authorized to delete this vault")
    
    # Step 3: Delete all documents inside this vault (by vault_id string)
    cursor = db.documents.find({"vault_id": id})
    async for doc in cursor:
        print(f"Deleting document {doc.get('_id')} from vault {id}")
        if doc.get("storage_url"):
            delete_file(doc["storage_url"])
        await db.access.delete_many({"document_id": str(doc["_id"])})
        await db.documents.delete_one({"_id": doc["_id"]})
    
    # Step 4: Delete the vault itself
    try:
        await db.vaults.delete_one({"_id": ObjectId(id)})
    except Exception:
        await db.vaults.delete_one({"_id": id})
    
    print(f"Vault {id} deleted successfully")
    await log_action(db, current_user.id, "vault_deleted", request)
    return {"message": "Vault and all its documents deleted successfully"}



