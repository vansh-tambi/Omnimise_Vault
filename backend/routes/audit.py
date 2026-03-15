from fastapi import APIRouter, Depends
from models.audit_log import AuditLog
from database.mongodb import get_database
from routes.auth import get_current_user, UserResponse
from typing import List

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("/logs", response_model=List[AuditLog])
async def get_audit_logs(
    current_user: UserResponse = Depends(get_current_user),
    db = Depends(get_database)
):
    cursor = db["audit_logs"].find({"user_id": current_user.id}).sort("timestamp", -1).limit(50)
    logs = await cursor.to_list(length=50)
    return logs
