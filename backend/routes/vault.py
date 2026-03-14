from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.user import UserResponse
from models.vault import VaultCreate, VaultResponse
from routes.auth import get_current_user
from services.vault_service import create_vault, get_user_vaults

router = APIRouter(prefix="/vault", tags=["vault"])

@router.post("/create", response_model=VaultResponse)
async def create_new_vault(vault: VaultCreate, current_user: UserResponse = Depends(get_current_user)):
    return await create_vault(vault, current_user.id)

@router.get("", response_model=List[VaultResponse])
async def list_vaults(current_user: UserResponse = Depends(get_current_user)):
    return await get_user_vaults(current_user.id)
