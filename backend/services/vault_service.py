from database.mongodb import get_database
from models.vault import VaultInDB, VaultCreate
from bson import ObjectId
from typing import List

async def create_vault(vault_data: VaultCreate, user_id: str) -> VaultInDB:
    db = get_database()
    from datetime import datetime
    vault_dict = vault_data.model_dump()
    vault_dict["user_id"] = user_id
    vault_dict["created_at"] = datetime.utcnow()

    result = await db.vaults.insert_one(vault_dict)
    vault_dict["id"] = str(result.inserted_id)
    return VaultInDB(**vault_dict)

async def get_user_vaults(user_id: str) -> List[VaultInDB]:
    db = get_database()
    cursor = db.vaults.find({"user_id": user_id})
    vaults = []
    async for document in cursor:
        document["id"] = str(document.pop("_id"))
        vaults.append(VaultInDB(**document))
    return vaults

async def check_vault_access(vault_id: str, user_id: str) -> bool:
    db = get_database()
    try:
        # Check if owner
        vault = await db.vaults.find_one({"_id": ObjectId(vault_id), "user_id": user_id})
        if vault:
            return True
        
        # Check if shared access
        access = await db.access.find_one({"vault_id": vault_id, "user_id": user_id})
        if access:
            return True
    except Exception:
        # Fallback if vault_id is string
        vault = await db.vaults.find_one({"_id": vault_id, "user_id": user_id})
        if vault:
            return True
        
    return False
