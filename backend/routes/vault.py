from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from models.user import UserResponse
from models.vault import VaultCreate, VaultResponse
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
    has_access = await check_vault_access(id, current_user.id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this vault")
    
    db = get_database()
    await log_action(db, current_user.id, "vault_unlocked", request)
    return {"message": "Vault unlocked and logged"}
