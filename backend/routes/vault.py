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
async def unlock_vault(id: str, payload: VaultUnlock, request: Request, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    import hashlib
    import base64
    
    try:
        vault = await db.vaults.find_one({"_id": ObjectId(id)})
    except:
        vault = await db.vaults.find_one({"_id": id})
        
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")

    has_access = await check_vault_access(id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
    
    # Verify PIN if it was set
    if vault.get("vault_pin_hash") and vault.get("vault_pin_salt"):
        try:
            salt_bytes = base64.b64decode(vault["vault_pin_salt"])
            # The frontend uses PBKDF2 with 100,000 iterations of SHA-256 for a 256-bit (32-byte) hash
            derived_key = hashlib.pbkdf2_hmac(
                'sha256', 
                payload.pin.encode(), 
                salt_bytes, 
                100000, 
                dklen=32
            )
            derived_hash = base64.b64encode(derived_key).decode()
            
            if derived_hash != vault["vault_pin_hash"]:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vault PIN")
        except Exception as e:
            print(f"PIN verification error: {e}")
            raise HTTPException(status_code=400, detail="Failed to verify PIN")
    
    await log_action(db, current_user.id, "vault_unlocked", request)
    return {"message": "Vault unlocked and logged"}

@router.delete("/{id}")
async def delete_vault(id: str, request: Request, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    from integrations.gcs_storage import delete_file
    
    try:
        vault_query = {"_id": ObjectId(id)}
    except:
        vault_query = {"_id": id}
        
    vault = await db.vaults.find_one({**vault_query, "user_id": current_user.id})
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found or not owned by you")
        
    # Delete all documents in this vault
    cursor = db.documents.find({"vault_id": id})
    async for doc in cursor:
        # Delete from storage
        if doc.get("storage_url"):
            delete_file(doc["storage_url"])
        # Delete access rules
        await db.access.delete_many({"document_id": str(doc["_id"])})
        # Delete document record
        await db.documents.delete_one({"_id": doc["_id"]})
        
    # Finally delete the vault itself
    await db.vaults.delete_one(vault_query)
    
    await log_action(db, current_user.id, "vault_deleted", request, vault_id=id)
    return {"message": "Vault and all its documents deleted successfully"}
