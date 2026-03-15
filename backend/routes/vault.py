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
            # Use PBKDF2 with SHA-256, 100k iterations, 32 bytes — same as frontend
            derived_key = hashlib.pbkdf2_hmac('sha256', payload.pin.encode(), salt_bytes, 100000, dklen=32)
            derived_hash = base64.b64encode(derived_key).decode()
            print(f"PIN verify: stored_hash={vault['vault_pin_hash'][:16]}... derived={derived_hash[:16]}...")
            
            if derived_hash != vault["vault_pin_hash"]:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vault PIN")
        except HTTPException:
            raise  # Pass through auth errors without wrapping
        except Exception as e:
            print(f"PIN verification error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to verify PIN: {str(e)}")
    
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


from pydantic import BaseModel
class VaultSettings(BaseModel):
    self_destruct_views: int | None = None
    self_destruct_at: str | None = None  # ISO datetime string or None

@router.put("/{id}/settings")
async def update_vault_settings(id: str, settings: VaultSettings, current_user: UserResponse = Depends(get_current_user)):
    db = get_database()
    from bson import ObjectId
    from datetime import datetime

    try:
        vault = await db.vaults.find_one({"_id": ObjectId(id)})
    except Exception:
        vault = await db.vaults.find_one({"_id": id})

    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")

    if str(vault.get("user_id", "")) != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this vault")

    update_fields = {}
    if settings.self_destruct_views is not None:
        update_fields["self_destruct_views"] = settings.self_destruct_views
    else:
        update_fields["self_destruct_views"] = None

    if settings.self_destruct_at:
        try:
            update_fields["self_destruct_at"] = datetime.fromisoformat(settings.self_destruct_at.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid datetime format for self_destruct_at")
    else:
        update_fields["self_destruct_at"] = None

    try:
        await db.vaults.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    except Exception:
        await db.vaults.update_one({"_id": id}, {"$set": update_fields})

    return {"message": "Vault settings saved successfully", **update_fields}
